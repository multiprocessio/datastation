package orc

import (
	"bytes"
	"fmt"
	"io"

	gproto "github.com/golang/protobuf/proto"
	"github.com/scritchley/orc/proto"
)

var (
	magic = "ORC"
	// WriterImplementation identifies the writer implementation
	WriterImplementation = uint32(3)
	// WriterVersion identifies the writer version being used.
	WriterVersion = uint32(6)
	// DefaultStripeTargetSize is the size in bytes over which a stripe should be written to the underlying file.
	DefaultStripeTargetSize int64 = 200 * 1024 * 1024
	// DefaultStripeTargetRowCount is the number of rows over which a stripe should be written to the underlying file.
	DefaultStripeTargetRowCount int64 = 1024 * 1024
	// DefaultStripeWriterTimezone is the timezone that writer adds into the stripe footer.
	DefaultStripeWriterTimezone string = "GMT"
	// DefaultCompressionChunkSize is the default size of compression chunks within each stream.
	DefaultCompressionChunkSize uint64 = 256 * 1024
	// DefaultRowIndexStride is the default number of rows between indexes
	DefaultRowIndexStride uint32 = 10000
)

type Writer struct {
	schema               *TypeDescription
	streams              streamWriterMap
	w                    io.Writer
	treeWriter           TreeWriter
	treeWriters          writerMap
	stripeRows           uint64
	stripeOffset         uint64
	stripeLength         uint64
	stripeIndexOffset    uint64
	stripeTargetSize     int64
	stripeTargetRowCount int64
	footer               *proto.Footer
	footerLength         uint64
	postScript           *proto.PostScript
	postScriptLength     uint8
	metadata             *proto.Metadata
	metadataLength       uint64
	totalRows            uint64
	statistics           statisticsMap
	indexes              map[int]*proto.RowIndex
	indexOffset          uint64
	chunkOffset          uint64
	compressionCodec     CompressionCodec
}

func ptrInt64(i int64) *int64 {
	return &i
}

type WriterConfigFunc func(w *Writer) error

func SetSchema(schema *TypeDescription) WriterConfigFunc {
	return func(w *Writer) error {
		w.schema = schema
		w.footer.Types = w.schema.Types()
		return nil
	}
}

func SetCompression(codec CompressionCodec) WriterConfigFunc {
	return func(w *Writer) error {
		switch codec.(type) {
		case nil:
		case CompressionNone:
		case CompressionSnappy:
			return fmt.Errorf("Unknown compression codec type %T", codec)
			// w.postScript.Compression = proto.CompressionKind_SNAPPY.Enum()
		case CompressionZlib:
			w.postScript.Compression = proto.CompressionKind_ZLIB.Enum()
		default:
			return fmt.Errorf("Unknown compression codec type %T", codec)
		}

		w.compressionCodec = codec
		return nil
	}
}

func SetStripeTargetSize(stripeTargetSize int64) WriterConfigFunc {
	return func(w *Writer) error {
		w.stripeTargetSize = stripeTargetSize
		return nil
	}
}

func AddUserMetadata(name string, value []byte) WriterConfigFunc {
	return func(w *Writer) error {
		w.footer.Metadata = append(w.footer.Metadata, &proto.UserMetadataItem{
			Name:  &name,
			Value: value,
		})
		return nil
	}
}

// NewWriter returns a new ORC file writer that writes to the provided io.Writer.
func NewWriter(w io.Writer, fns ...WriterConfigFunc) (*Writer, error) {
	// Construct the initial writer config, including the initial footer,
	// postscript and metadata sections.
	writer := &Writer{
		w:                    w,
		stripeOffset:         uint64(len(magic)),
		stripeTargetSize:     DefaultStripeTargetSize,
		stripeTargetRowCount: DefaultStripeTargetRowCount,
		streams:              make(streamWriterMap),
		statistics:           make(statisticsMap),
		indexes:              make(map[int]*proto.RowIndex),
		footer: &proto.Footer{
			Writer:         ptrUint32(WriterImplementation),
			RowIndexStride: ptrUint32(DefaultRowIndexStride),
			Statistics:     []*proto.ColumnStatistics{},
		},
		postScript: &proto.PostScript{
			Magic:                ptrStr(magic),
			WriterVersion:        ptrUint32(WriterVersion),
			CompressionBlockSize: ptrUint64(DefaultCompressionChunkSize),
			Compression:          proto.CompressionKind_NONE.Enum(),
			Version:              []uint32{Version0_12.major, Version0_12.minor},
		},
		metadata: &proto.Metadata{
			StripeStats: []*proto.StripeStatistics{},
		},
		compressionCodec: CompressionNone{},
	}

	// Apply any WriterConfigFuncs to the new writer.
	for _, fn := range fns {
		err := fn(writer)
		if err != nil {
			return nil, err
		}
	}
	// Initialise the ORC file.
	err := writer.init()
	if err != nil {
		return nil, err
	}
	return writer, nil
}

func (w *Writer) Schema() *TypeDescription {
	return w.schema
}

func (w *Writer) Write(values ...interface{}) error {
	w.stripeRows++
	w.totalRows++
	err := w.treeWriter.Write(values)
	if err != nil {
		return err
	}
	if w.totalRows%uint64(w.footer.GetRowIndexStride()) == 0 {
		// Records and resets indexes for each writer.
		w.recordPositions()

		if w.treeWriters.size() >= w.stripeTargetSize {
			return w.writeStripe()
		}
		if int64(w.stripeRows) >= w.stripeTargetRowCount {
			return w.writeStripe()
		}
	}
	return nil
}

// Flush the current stripe to the underlying Writer
func (w *Writer) Flush() error {
	return w.writeStripe()
}

func (w *Writer) init() error {
	if err := w.initOrc(); err != nil {
		return err
	}
	if err := w.initWriters(); err != nil {
		return err
	}
	return nil
}

func (w *Writer) initOrc() error {
	_, err := w.w.Write([]byte(magic))
	if err != nil {
		return err
	}
	return nil
}

func (w *Writer) initWriters() error {
	var err error
	w.treeWriters = make(writerMap)
	w.treeWriter, err = createTreeWriter(w.compressionCodec, w.schema, w.treeWriters)
	if err != nil {
		return err
	}
	return nil
}

func (w *Writer) closeWriters() error {
	if err := w.flushWriters(); err != nil {
		return err
	}
	return w.treeWriter.Close()
}

func (w *Writer) flushWriters() error {
	if err := w.treeWriter.Flush(); err != nil {
		return err
	}
	w.recordPositions()
	return nil
}

func (w *Writer) recordPositions() {
	w.treeWriter.RecordPositions()
}

func (w *Writer) writePostScript() error {
	byt, err := gproto.Marshal(w.postScript)
	if err != nil {
		return err
	}
	if len(byt) > maxPostScriptSize {
		return fmt.Errorf("postscript larger than max allowed size of %v bytes: %v", maxPostScriptSize, len(byt))
	}
	n, err := w.w.Write(byt)
	if err != nil {
		return err
	}
	if n != len(byt) {
		return fmt.Errorf("Expected to write a postcript with %d bytes, but wrote %d", len(byt), n)
	}
	// Write the length of the post script in the last byte
	_, err = w.w.Write([]byte{byte(len(byt))})
	if err != nil {
		return err
	}
	return nil
}

func (w *Writer) writeFooter() error {
	totalRows := w.totalRows
	w.footer.NumberOfRows = &totalRows
	w.footer.Statistics = w.statistics.statistics()
	byt, err := gproto.Marshal(w.footer)
	if err != nil {
		return err
	}

	var buf bytes.Buffer

	f := w.compressionCodec.Encoder(&buf)
	n, err := f.Write(byt)
	if err != nil {
		return err
	}
	if n != len(byt) {
		return fmt.Errorf("Expected to write %d bytes, wrote %d", len(byt), n)
	}

	err = f.Close()
	if err != nil {
		return err
	}

	nCompressed, err := io.Copy(w.w, &buf)
	if err != nil {
		return err
	}

	footerLength := uint64(nCompressed)
	w.postScript.FooterLength = &footerLength

	return nil
}

func (w *Writer) writeMetadata() error {
	byt, err := gproto.Marshal(w.metadata)
	if err != nil {
		return err
	}

	var buf bytes.Buffer

	f := w.compressionCodec.Encoder(&buf)
	n, err := f.Write(byt)
	if err != nil {
		return err
	}
	if n != len(byt) {
		return fmt.Errorf("Expected to write %d bytes, wrote %d", len(byt), n)
	}

	err = f.Close()
	if err != nil {
		return err
	}

	nCompressed, err := io.Copy(w.w, &buf)
	if err != nil {
		return err
	}

	metadataLength := uint64(nCompressed)
	w.postScript.MetadataLength = &metadataLength

	return nil
}

func (w *Writer) writeStripe() error {

	// Close the current set of writers.
	if err := w.closeWriters(); err != nil {
		return err
	}

	// Write each stream to the underlying writer.
	var streams []*proto.Stream
	var stripeIndexLength uint64
	var stripeDataLength uint64
	stripeStatistics := make(statisticsMap)

	buf := &bytes.Buffer{}

	// Iterate through the TreeWriters and write their output
	// to the underlying writer.
	err := w.treeWriters.forEach(func(id int, t TreeWriter) error {

		// Add to the running stripe statistics.
		stripeStatistics.add(id, t.Statistics())

		// Write rowIndex for the column.
		rowIndex := t.RowIndex()
		if rowIndex == nil {
			return nil
		}
		byt, err := gproto.Marshal(rowIndex)
		if err != nil {
			return err
		}
		encoder := w.compressionCodec.Encoder(buf)

		n, err := encoder.Write(byt)
		if err != nil {
			return err
		}
		if n != len(byt) {
			return fmt.Errorf("Expected to write %d bytes, wrote %d", len(byt), n)
		}

		err = encoder.Close()
		if err != nil {
			return err
		}

		l := buf.Len()
		nn, err := io.Copy(w.w, buf)
		if err != nil {
			return err
		}

		if int(nn) != l {
			return fmt.Errorf("Expected to write %d bytes, wrote %d", l, nn)
		}

		stripeIndexLength += uint64(l)
		streamInfo := &proto.Stream{
			Column: ptrUint32(uint32(id)),
			Kind:   proto.Stream_ROW_INDEX.Enum(),
			Length: ptrUint64(uint64(l)),
		}
		streams = append(streams, streamInfo)
		return nil
	})
	if err != nil {
		return err
	}

	err = w.treeWriters.forEach(func(id int, t TreeWriter) error {
		// Then write the streams.
		for _, stream := range t.Streams() {
			// Get the length of the stream and its kind.
			length := stream.buffer.Len()
			kind := *stream.kind
			// If the stream is optional and has zero length after
			// closing then ignore it and continue to the next stream.
			if isOptionalStream(*stream.kind) && length == 0 {
				continue
			}
			streamInfo := &proto.Stream{
				Column: ptrUint32(uint32(id)),
				Kind:   &kind,
				Length: ptrUint64(uint64(length)),
			}
			stripeDataLength += uint64(length)
			streams = append(streams, streamInfo)
			_, err := io.Copy(w.w, stream.buffer)
			if err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return err
	}

	// Create a stripe footer and write it to the underlying writer.
	stripeFooter := &proto.StripeFooter{
		Streams:        streams,
		Columns:        w.treeWriters.encodings(),
		WriterTimezone: &DefaultStripeWriterTimezone,
	}

	byt, err := gproto.Marshal(stripeFooter)
	if err != nil {
		return err
	}

	preFooterLength := buf.Len()
	encoder := w.compressionCodec.Encoder(buf)
	nn, err := encoder.Write(byt)
	if err != nil {
		return err
	}
	if nn != len(byt) {
		return fmt.Errorf("Expected to write %d bytes, wrote %d", len(byt), nn)
	}
	err = encoder.Close()
	if err != nil {
		return err
	}
	postFooterLength := buf.Len()
	n, err := io.Copy(w.w, buf)
	if err != nil {
		return err
	}
	if int(n) != postFooterLength {
		return fmt.Errorf("Expected to write %d bytes, wrote %d", postFooterLength, n)
	}
	buf.Reset()

	stripeRows := w.stripeRows
	// Reset the stripe rows ready for the next stripe.
	w.stripeRows = 0
	w.stripeIndexOffset = 0

	// Append stripe information to the footer
	footerLength := uint64(postFooterLength - preFooterLength)
	offset := w.stripeOffset
	w.footer.Stripes = append(w.footer.Stripes, &proto.StripeInformation{
		Offset:       &offset,
		IndexLength:  &stripeIndexLength,
		DataLength:   ptrUint64(stripeDataLength),
		FooterLength: &footerLength,
		NumberOfRows: &stripeRows,
	})

	// Update the stripe offset for the next stripe by combining the index, data and footer lengths.
	w.stripeOffset += stripeIndexLength + stripeDataLength + footerLength

	// Add stripe statistics to metadata
	w.metadata.StripeStats = append(w.metadata.StripeStats, &proto.StripeStatistics{
		ColStats: stripeStatistics.statistics(),
	})

	// Merge the stripe statistics with the total statistics.
	w.statistics.merge(stripeStatistics)

	return w.initWriters()
}

func (w *Writer) Close() error {
	if err := w.writeStripe(); err != nil {
		return err
	}
	if err := w.writeMetadata(); err != nil {
		return err
	}
	if err := w.writeFooter(); err != nil {
		return err
	}
	if err := w.writePostScript(); err != nil {
		return err
	}
	return nil
}

func ptrUint32(u uint32) *uint32 {
	return &u
}

func ptrUint64(u uint64) *uint64 {
	return &u
}

func ptrStr(s string) *string {
	return &s
}

func isOptionalStream(kind proto.Stream_Kind) bool {
	switch kind {
	case proto.Stream_PRESENT, proto.Stream_BLOOM_FILTER:
		return true
	default:
		return false
	}
}
