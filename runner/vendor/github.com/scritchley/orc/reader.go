package orc

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"io/ioutil"

	gproto "github.com/golang/protobuf/proto"

	"github.com/scritchley/orc/proto"
)

var (
	errNoPostScript = errors.New("postscript is nil")
	errNoFooter     = errors.New("footer is nil")
	errNoTypes      = errors.New("no types")
)

const (
	maxPostScriptSize = 256
)

type SizedReaderAt interface {
	io.ReaderAt
	Size() int64
}

type Reader struct {
	r                        SizedReaderAt
	postScript               *proto.PostScript
	footer                   *proto.Footer
	metadata                 *proto.Metadata
	currentStripeOffset      int
	currentStripeInformation *proto.StripeInformation
	schema                   *TypeDescription
}

func NewReader(r SizedReaderAt) (*Reader, error) {
	reader := &Reader{
		r: r,
	}
	err := reader.extractMetaInfoFromFooter()
	if err != nil {
		return nil, err
	}
	return reader, nil
}

func (r *Reader) getCodec() (CompressionCodec, error) {
	if r.postScript == nil {
		return nil, errNoPostScript
	}
	compressionKind := r.postScript.GetCompression()
	switch compressionKind {
	case proto.CompressionKind_NONE:
		return CompressionNone{}, nil
	case proto.CompressionKind_ZLIB:
		return CompressionZlib{}, nil
	case proto.CompressionKind_SNAPPY:
		return CompressionSnappy{}, nil
	default:
		return nil, fmt.Errorf("unsupported compression kind %s", compressionKind)
	}
}

func (r *Reader) Schema() *TypeDescription {
	return r.schema
}

func (r *Reader) Metadata() *proto.Metadata {
	return r.metadata
}

func (r *Reader) extractMetaInfoFromFooter() error {

	size := int(r.r.Size())
	psPlusByte := maxPostScriptSize + 1
	if psPlusByte > size {
		psPlusByte = size
	}

	// Read the last 256 bytes into buffer to get postscript
	postScriptBytes := make([]byte, psPlusByte, psPlusByte)
	sr := io.NewSectionReader(r.r, int64(size-psPlusByte), int64(psPlusByte)) // Use constant
	_, err := io.ReadFull(sr, postScriptBytes)
	if err != nil {
		return err
	}
	psLen := int(postScriptBytes[len(postScriptBytes)-1])
	psOffset := len(postScriptBytes) - 1 - psLen
	r.postScript = &proto.PostScript{}
	err = gproto.Unmarshal(postScriptBytes[psOffset:psOffset+psLen], r.postScript)
	if err != nil {
		return err
	}

	// Get the offset and length of the footer and preallocate a byte slice.
	footerLength := int(r.postScript.GetFooterLength())
	footerBytes := make([]byte, footerLength, footerLength)
	footerOffset := size - psLen - 1 - footerLength

	// Get the offset and length of the metadata and preallocate a byte slice.
	metadataLength := int(r.postScript.GetMetadataLength())
	metadataBytes := make([]byte, metadataLength, metadataLength)
	metadataOffset := size - psLen - 1 - footerLength - metadataLength

	// Create a section reader containing the metadata and read into the byte slice.
	metadataReader := io.NewSectionReader(r.r, int64(metadataOffset), int64(metadataLength))
	_, err = io.ReadFull(metadataReader, metadataBytes)
	if err != nil {
		return err
	}

	// Create a section reader containing the footer and read into the byte slice.
	footerReader := io.NewSectionReader(r.r, int64(footerOffset), int64(footerLength))
	_, err = io.ReadFull(footerReader, footerBytes)
	if err != nil {
		return err
	}

	// Retrieve the CompressionCodec.
	codec, err := r.getCodec()
	if err != nil {
		return err
	}

	// Decode the metadata into a new byte slice.
	metadataDecoder := codec.Decoder(bytes.NewReader(metadataBytes))
	decodedMetadataBytes, err := ioutil.ReadAll(metadataDecoder)
	if err != nil {
		return err
	}

	// Unmarshal the metadata and store against the reader.
	r.metadata = &proto.Metadata{}
	err = gproto.Unmarshal(decodedMetadataBytes, r.metadata)
	if err != nil {
		return err
	}

	// Decode the footer into a new byte slice.
	footerDecoder := codec.Decoder(bytes.NewReader(footerBytes))
	decodedFooterBytes, err := ioutil.ReadAll(footerDecoder)
	if err != nil {
		return err
	}

	// Unmarshal the footer and store against the reader.
	r.footer = &proto.Footer{}
	err = gproto.Unmarshal(decodedFooterBytes, r.footer)
	if err != nil {
		return err
	}

	// Determine the schema of the file
	types, err := r.getTypes()
	if err != nil {
		return err
	}

	r.schema, err = r.createSchema(types, 0)
	if err != nil {
		return err
	}

	return nil

}

func (r *Reader) getStripe(stripeNum int, included ...int) (*Stripe, error) {
	stripes, err := r.getStripes()
	if err != nil {
		return nil, err
	}
	if stripeNum >= len(stripes) {
		return nil, io.EOF
	}
	stripe := NewStripe(stripes[stripeNum], included...)
	err = stripe.FromReader(r)
	if err != nil {
		return nil, err
	}
	return stripe, nil
}

func (r *Reader) createSchema(types []*proto.Type, rootColumn int) (*TypeDescription, error) {
	if len(types) == 0 {
		return nil, errNoTypes
	}
	var td *TypeDescription
	var err error
	root := types[rootColumn]
	switch root.GetKind() {
	case proto.Type_BOOLEAN:
		return NewTypeDescription(SetCategory(CategoryBoolean))
	case proto.Type_BINARY:
		return NewTypeDescription(SetCategory(CategoryBinary))
	case proto.Type_LONG:
		return NewTypeDescription(SetCategory(CategoryLong))
	case proto.Type_INT:
		return NewTypeDescription(SetCategory(CategoryInt))
	case proto.Type_SHORT:
		return NewTypeDescription(SetCategory(CategoryShort))
	case proto.Type_BYTE:
		return NewTypeDescription(SetCategory(CategoryByte))
	case proto.Type_FLOAT:
		return NewTypeDescription(SetCategory(CategoryFloat))
	case proto.Type_DOUBLE:
		return NewTypeDescription(SetCategory(CategoryDouble))
	case proto.Type_DECIMAL:
		td, err = NewTypeDescription(SetCategory(CategoryDecimal))
		if err != nil {
			return nil, err
		}
		scale := int(root.GetScale())
		if scale != 0 {
			err = td.withScale(scale)
			if err != nil {
				return nil, err
			}
		}
		precision := int(root.GetPrecision())
		if precision != 0 {
			err = td.withPrecision(precision)
			if err != nil {
				return nil, err
			}
		}
		return td, nil
	case proto.Type_STRING:
		return NewTypeDescription(SetCategory(CategoryString))
	case proto.Type_CHAR:
		return NewTypeDescription(SetCategory(CategoryChar))
	case proto.Type_VARCHAR:
		td, err = NewTypeDescription(SetCategory(CategoryVarchar))
		if err != nil {
			return nil, err
		}
		length := int(root.GetMaximumLength())
		if length != 0 {
			err = td.withMaxLength(length)
			if err != nil {
				return nil, err
			}
		}
		return td, nil
	case proto.Type_TIMESTAMP:
		return NewTypeDescription(SetCategory(CategoryTimestamp))
	case proto.Type_DATE:
		return NewTypeDescription(SetCategory(CategoryDate))
	case proto.Type_LIST:
		subTypes := root.GetSubtypes()
		if len(subTypes) != 1 {
			return nil, fmt.Errorf("unexpected number of subtypes for list: %v", len(subTypes))
		}
		child, err := r.createSchema(types, int(subTypes[0]))
		if err != nil {
			return nil, err
		}
		return createList(child)
	case proto.Type_MAP:
		subTypes := root.GetSubtypes()
		if len(subTypes) != 2 {
			return nil, fmt.Errorf("unexpected number of subtypes for map: %v", len(subTypes))
		}
		key, err := r.createSchema(types, int(subTypes[0]))
		if err != nil {
			return nil, err
		}
		value, err := r.createSchema(types, int(subTypes[1]))
		if err != nil {
			return nil, err
		}
		return createMap(key, value)
	case proto.Type_UNION:
		td, err := NewTypeDescription(SetCategory(CategoryUnion))
		if err != nil {
			return nil, err
		}
		subTypes := root.GetSubtypes()
		for f := 0; f < len(subTypes); f++ {
			child, err := r.createSchema(types, int(subTypes[f]))
			if err != nil {
				return nil, err
			}
			err = td.addUnionChild(child)
			if err != nil {
				return nil, err
			}
		}
		return td, nil
	case proto.Type_STRUCT:
		td, err = NewTypeDescription(SetCategory(CategoryStruct))
		if err != nil {
			return nil, err
		}
		subTypes := root.GetSubtypes()
		fieldNames := root.GetFieldNames()
		for f := 0; f < len(subTypes); f++ {
			child, err := r.createSchema(types, int(subTypes[f]))
			if err != nil {
				return nil, err
			}
			err = td.addField(fieldNames[f], child)
			if err != nil {
				return nil, err
			}
		}
		return td, nil
	default:
		return nil, fmt.Errorf("unsupported kind: %s", root.GetKind())
	}
}

func (r *Reader) getTypes() ([]*proto.Type, error) {
	if r.footer != nil {
		return r.footer.GetTypes(), nil
	}
	return nil, errNoFooter
}

func (r *Reader) getStripes() ([]*proto.StripeInformation, error) {
	if r.footer != nil {
		return r.footer.GetStripes(), nil
	}
	return nil, errNoFooter
}

func (r *Reader) Close() error {
	return nil
}

func (r *Reader) Select(fields ...string) *Cursor {
	cursor := &Cursor{Reader: r}
	return cursor.Select(fields...)
}

func (r *Reader) NumRows() int {
	return int(r.footer.GetNumberOfRows())
}

func (r *Reader) NumStripes() (int, error) {
	stripes, err := r.getStripes()
	if err != nil {
		return 0, err
	}

	return len(stripes), nil
}

type Stripe struct {
	included []int
	*proto.StripeInformation
	columns map[int]*proto.ColumnEncoding
	streamMap
}

func NewStripe(info *proto.StripeInformation, included ...int) *Stripe {
	return &Stripe{
		StripeInformation: info,
		included:          included,
		columns:           make(map[int]*proto.ColumnEncoding),
		streamMap:         make(streamMap),
	}
}

func (s *Stripe) FromReader(r *Reader) error {
	if err := s.unmarshalStripeFooter(r); err != nil {
		return err
	}
	return nil
}

func (s *Stripe) unmarshalStripeFooter(r *Reader) error {
	// Unmarshal the stripe footer
	stripeOffset := int64(s.GetOffset())
	stripeFooterOffset := stripeOffset + int64(s.GetIndexLength()+s.GetDataLength())
	stripeFooterLength := int64(s.GetFooterLength())
	stripeFooterReader := io.NewSectionReader(r.r, stripeFooterOffset, stripeFooterLength)

	codec, err := r.getCodec()
	if err != nil {
		return err
	}

	// Decode the footer into a new byte slice.
	stripeFooterDecoded := codec.Decoder(stripeFooterReader)
	decodedStripeFooterBytes, err := ioutil.ReadAll(stripeFooterDecoded)
	if err != nil {
		return err
	}

	// Unmarshal the footer and store against the reader.
	stripeFooter := &proto.StripeFooter{}
	err = gproto.Unmarshal(decodedStripeFooterBytes, stripeFooter)
	if err != nil {
		return err
	}

	// Store the columns and their encoding types so that we can access them later.
	columns := stripeFooter.GetColumns()
	for i, column := range columns {
		s.columns[i] = column
	}

	streamOffset := stripeOffset
	streamsProto := stripeFooter.GetStreams()

	if len(streamsProto) == 0 {
		return io.EOF
	}

	// Iterate through the streams and allocate byte buffers for each.
	for _, stream := range streamsProto {
		// Get the columnID for the stream
		columnID := int(stream.GetColumn())
		// Determine the streams length
		streamLength := int64(stream.GetLength())
		// Determine if this stream should be included
		var include bool
		for i := range s.included {
			if s.included[i] == columnID {
				include = true
			}
		}
		// Only allocate buffers for columns that we are planning to read.
		if include {
			// Create a new section reader for the length of the stream.
			streamReader := io.NewSectionReader(r.r, streamOffset, streamLength)
			// Retrieve the codec
			codec, err := r.getCodec()
			if err != nil {
				return err
			}
			dec := codec.Decoder(streamReader)
			// Copy the stream into a buffer.
			var streamBuf bytes.Buffer
			_, err = io.Copy(&streamBuf, dec)
			if err != nil {
				return err
			}
			// Store the byte buffer within the streamMap using a streamName.
			name := streamName{
				columnID: int(stream.GetColumn()),
				kind:     stream.GetKind(),
			}
			s.streamMap.set(name, &streamBuf)
		}
		// Increment the streamOffset for the next stream.
		streamOffset += streamLength
	}

	return nil
}

func (s *Stripe) getColumn(columnID int) (*proto.ColumnEncoding, error) {
	if columnID > len(s.columns) || s.columns[columnID] == nil {
		return nil, fmt.Errorf("column: %v does not exist", columnID)
	}
	return s.columns[columnID], nil
}
