package orc

import (
	"encoding/binary"
	"fmt"
	"io"
	"math"
	"reflect"
	"time"

	"github.com/scritchley/orc/proto"
)

// TreeWriter is an interface for writing to a stream.
type TreeWriter interface {
	// Encoding returns the column encoding used for the TreeWriter.
	Encoding() *proto.ColumnEncoding
	// Write writes the interface value i to the TreeWriter, it returns an error
	// if i is of an unexpected type or if an error occurs whilst writing to
	// the underlying stream.
	Write(i interface{}) error
	// Close flushes the remaining data and closes the writer.
	Close() error
	// Flush flushes any outstanding data to the underlying writer.
	Flush() error
	// Streams returns a slice of streams for the TreeWriter.
	Streams() []Stream
	// RowIndex returns the RowIndex for the writer.
	RowIndex() *proto.RowIndex
	// RecordPositions
	RecordPositions()
	// Statistics
	Statistics() ColumnStatistics
}

// BaseTreeWriter is a TreeWriter implementation that writes to the present stream. It
// is the basis for all other TreeWriter implementations.
type BaseTreeWriter struct {
	category          Category
	codec             CompressionCodec
	present           *BooleanWriter
	buffer            *BufferedWriter
	currentStatistics ColumnStatistics
	statistics        ColumnStatistics
	positionRecorders PositionRecorders
	indexEntries      []*proto.RowIndexEntry
	streams           []Stream
	numValues         uint64
	hasNull           bool
}

// NewBaseTreeWriter is a TreeWriter that is embedded in all other TreeWriter implementations.
func NewBaseTreeWriter(category Category, codec CompressionCodec) BaseTreeWriter {
	b := BaseTreeWriter{
		category:          category,
		codec:             codec,
		statistics:        NewColumnStatistics(category),
		currentStatistics: NewColumnStatistics(category),
		indexEntries:      make([]*proto.RowIndexEntry, 0),
		positionRecorders: make(PositionRecorders, 0),
	}
	present := b.AddStream(proto.Stream_PRESENT.Enum())
	b.AddPositionRecorder(present)
	b.present = NewBooleanWriter(present.buffer)
	b.buffer = present.buffer
	return b
}

func (b *BaseTreeWriter) positions() []uint64 {
	var positions []uint64
	for _, recorder := range b.positionRecorders {
		switch b.codec.(type) {
		case CompressionNone:
			positions = append(positions, recorder.Positions()...)
		default:
			//TODO: Check if this is correct
			positions = append(positions, recorder.Positions()...)
		}
	}
	if !b.hasNull {
		return positions[1:]
	}
	return positions
}

func (b *BaseTreeWriter) RecordPositions() {
	b.indexEntries = append(b.indexEntries, &proto.RowIndexEntry{
		Positions:  b.positions(),
		Statistics: b.currentStatistics.Statistics(),
	})
	b.currentStatistics = NewColumnStatistics(b.category)
}

// Write checks whether i is nil and writes an appropriate true or false value to
// the underlying isPresent stream.
func (b *BaseTreeWriter) Write(i interface{}) error {
	// Add the value to the statistics
	b.statistics.Add(i)
	b.currentStatistics.Add(i)
	// If no nulls have been received yet, increment the numValues count.
	if !b.hasNull {
		b.numValues++
	}
	// isPresent is optional, therefore, support nil BooleanWriter
	if b.present == nil {
		return nil
	}
	if i == nil {
		// The stream has nulls, therefore, set hasNull to
		// true and write the prior values to the stream.
		b.hasNull = true
		for j := uint64(1); j < b.numValues; j++ {
			err := b.present.WriteBool(true)
			if err != nil {
				return err
			}
		}
		b.numValues = 0
		// If interface value is nil, then write false to isPresent stream.
		return b.present.WriteBool(false)
	}
	if b.hasNull {
		// Write to the stream only if it has nulls.
		return b.present.WriteBool(true)
	}
	return nil
}

// Close flushes the underlying BufferedWriter returning an error if one occurs.
func (b *BaseTreeWriter) Close() error {
	if err := b.present.Close(); err != nil {
		return err
	}
	// If the column has no nulls then reset the
	// underlying buffer.
	if !b.statistics.Statistics().GetHasNull() {
		b.buffer.Reset()
		b.buffer.written = 0
	}
	return b.buffer.Close()
}

// Flush flushes the underlying BufferedWriter returning an error if one occurs.
func (b *BaseTreeWriter) Flush() error {
	if err := b.present.Flush(); err != nil {
		return err
	}
	return b.buffer.Flush()
}

func (b *BaseTreeWriter) AddStream(kind *proto.Stream_Kind) Stream {
	s := Stream{
		kind:   kind,
		buffer: NewBufferedWriter(b.codec),
	}
	b.streams = append(b.streams, s)
	return s
}

func (b *BaseTreeWriter) AddPositionRecorder(recorder PositionRecorder) {
	b.positionRecorders = append(b.positionRecorders, recorder)
}

func (b *BaseTreeWriter) buffers() []*BufferedWriter {
	buffers := make([]*BufferedWriter, len(b.streams))
	for i := range b.streams {
		buffers[i] = b.streams[i].buffer
	}
	return buffers
}

func (b *BaseTreeWriter) Streams() []Stream {
	return b.streams
}

func (b *BaseTreeWriter) RowIndex() *proto.RowIndex {
	if !b.category.isPrimitive {
		return nil
	}
	return &proto.RowIndex{
		Entry: b.indexEntries,
	}
}

func (b *BaseTreeWriter) Statistics() ColumnStatistics {
	return b.statistics
}

// IntegerWriter is an interface implemented by all integer type writers.
type IntegerWriter interface {
	WriteInt(value int64) error
	Close() error
	Flush() error
}

func createIntegerWriter(kind proto.ColumnEncoding_Kind, w io.ByteWriter, signed bool) (IntegerWriter, error) {
	switch kind {
	case proto.ColumnEncoding_DIRECT_V2, proto.ColumnEncoding_DICTIONARY_V2:
		return NewRunLengthIntegerWriterV2(w, signed), nil
	case proto.ColumnEncoding_DIRECT, proto.ColumnEncoding_DICTIONARY:
		return NewRunLengthIntegerWriter(w, signed), nil
	default:
		return nil, fmt.Errorf("unknown encoding: %s", kind)
	}
}

// IntegerTreeWriter is a TreeWriter implementation that writes an integer type column.
type IntegerTreeWriter struct {
	BaseTreeWriter
	IntegerWriter
	*BufferedWriter
	encoding *proto.ColumnEncoding
}

// NewIntegerTreeWriter returns a new IntegerTreeWriter.
func NewIntegerTreeWriter(category Category, codec CompressionCodec) (*IntegerTreeWriter, error) {
	base := NewBaseTreeWriter(category, codec)
	data := base.AddStream(proto.Stream_DATA.Enum())
	base.AddPositionRecorder(data)
	// TODO: Inherit column encoding kind from orc.Writer ORC file version.
	columnEncoding := proto.ColumnEncoding_DIRECT_V2
	iwriter, err := createIntegerWriter(columnEncoding, data.buffer, true)
	if err != nil {
		return nil, err
	}
	return &IntegerTreeWriter{
		BaseTreeWriter: base,
		IntegerWriter:  iwriter,
		BufferedWriter: data.buffer,
		encoding: &proto.ColumnEncoding{
			Kind: columnEncoding.Enum(),
		},
	}, nil
}

// WriteInt writes an integer value returning an error if one occurs.
func (w *IntegerTreeWriter) WriteInt(value int64) error {
	return w.IntegerWriter.WriteInt(value)
}

// Write writes a value returning an error if one occurs. It accepts any form of
// integer or a nil value for writing nulls to the stream. Any other types will
// return an error.
func (w *IntegerTreeWriter) Write(value interface{}) error {
	switch t := value.(type) {
	case nil:
		// If the value is nil, return with no error. The value is null
		// and a false value will have been written to the present stream.
		// First write the value to the present column.
		if err := w.BaseTreeWriter.Write(value); err != nil {
			return err
		}
		return nil
	case int:
		// First write the value to the present column.
		if err := w.BaseTreeWriter.Write(int64(t)); err != nil {
			return err
		}
		return w.WriteInt(int64(t))
	case int32:
		// First write the value to the present column.
		if err := w.BaseTreeWriter.Write(int64(t)); err != nil {
			return err
		}
		return w.WriteInt(int64(t))
	case int64:
		// First write the value to the present column.
		if err := w.BaseTreeWriter.Write(t); err != nil {
			return err
		}
		return w.WriteInt(t)
	default:
		return fmt.Errorf("cannot write %T to integer column type", t)
	}
}

// Close closes the underlying writers returning an error if one occurs.
func (w *IntegerTreeWriter) Close() error {
	if err := w.BaseTreeWriter.Close(); err != nil {
		return err
	}
	if err := w.IntegerWriter.Close(); err != nil {
		return err
	}
	return w.BufferedWriter.Close()
}

// Flush flushes the underlying writers returning an error if one occurs.
func (w *IntegerTreeWriter) Flush() error {
	if err := w.BaseTreeWriter.Flush(); err != nil {
		return err
	}
	if err := w.IntegerWriter.Flush(); err != nil {
		return err
	}
	return w.BufferedWriter.Flush()
}

// Encoding returns the column encoding used for the IntegerTreeWriter.
func (w *IntegerTreeWriter) Encoding() *proto.ColumnEncoding {
	return w.encoding
}

// StructTreeWriter is a TreeWriter implementation that can write a struct column type.
type StructTreeWriter struct {
	BaseTreeWriter
	children []TreeWriter
}

// NewStructTreeWriter returns a StructTreeWriter using the provided io.Writer and children
// TreeWriters. It additionally returns an error if one occurs.
func NewStructTreeWriter(category Category, codec CompressionCodec, children []TreeWriter) (*StructTreeWriter, error) {
	return &StructTreeWriter{
		BaseTreeWriter: NewBaseTreeWriter(category, codec),
		children:       children,
	}, nil
}

// Write writes a value to the underlying child TreeWriters. It returns
// an error if one occurs.
func (s *StructTreeWriter) Write(value interface{}) error {
	// First write the value to the present column.
	if err := s.BaseTreeWriter.Write(value); err != nil {
		return err
	}
	values, ok := value.([]interface{})
	if !ok {
		return fmt.Errorf("wrong type for struct tree reader, expected: %T, got: %T", []interface{}{}, value)
	}
	if len(values) != len(s.children) {
		return fmt.Errorf("wrong number of values, expected: %v, got: %v", len(s.children), len(values))
	}
	for i := range s.children {
		err := s.children[i].Write(values[i])
		if err != nil {
			return err
		}
	}
	return nil
}

// Close closes the StructTreeWriter and its child TreeWriters returning an
// error if one occurs.
func (s *StructTreeWriter) Close() error {
	if err := s.BaseTreeWriter.Close(); err != nil {
		return err
	}
	for i := range s.children {
		err := s.children[i].Close()
		if err != nil {
			return err
		}
	}
	return nil
}

// Flush flushes the StructTreeWriter and its child TreeWriters returning an
// error if one occurs.
func (s *StructTreeWriter) Flush() error {
	if err := s.BaseTreeWriter.Flush(); err != nil {
		return err
	}
	for i := range s.children {
		err := s.children[i].Flush()
		if err != nil {
			return err
		}
	}
	return nil
}

// Encoding returns the column encoding for the StructTreeWriter.
func (s *StructTreeWriter) Encoding() *proto.ColumnEncoding {
	return &proto.ColumnEncoding{
		Kind: proto.ColumnEncoding_DIRECT.Enum(),
	}
}

func (s *StructTreeWriter) RecordPositions() {
	s.BaseTreeWriter.RecordPositions()
	for _, child := range s.children {
		child.RecordPositions()
	}
}

type BooleanTreeWriter struct {
	BaseTreeWriter
	*BooleanWriter
	*BufferedWriter
}

func NewBooleanTreeWriter(category Category, codec CompressionCodec) (*BooleanTreeWriter, error) {
	base := NewBaseTreeWriter(category, codec)
	data := base.AddStream(proto.Stream_DATA.Enum())
	base.AddPositionRecorder(data)
	return &BooleanTreeWriter{
		BaseTreeWriter: base,
		BooleanWriter:  NewBooleanWriter(data.buffer),
		BufferedWriter: data.buffer,
	}, nil
}

func (b *BooleanTreeWriter) Write(value interface{}) error {
	if value == nil {
		return b.BaseTreeWriter.Write(value)
	}
	if bv, ok := value.(bool); ok {
		if err := b.BaseTreeWriter.Write(true); err != nil {
			return err
		}
		return b.BooleanWriter.WriteBool(bv)
	}
	return fmt.Errorf("expected bool or nil value, received %T", value)
}

func (b *BooleanTreeWriter) Close() error {
	if err := b.BaseTreeWriter.Close(); err != nil {
		return err
	}
	if err := b.BooleanWriter.Close(); err != nil {
		return err
	}
	return b.BufferedWriter.Close()
}

func (b *BooleanTreeWriter) Flush() error {
	if err := b.BaseTreeWriter.Flush(); err != nil {
		return err
	}
	if err := b.BooleanWriter.Flush(); err != nil {
		return err
	}
	return b.BufferedWriter.Flush()
}

func (b *BooleanTreeWriter) Encoding() *proto.ColumnEncoding {
	return &proto.ColumnEncoding{
		Kind: proto.ColumnEncoding_DIRECT.Enum(),
	}
}

// FloatTreeWriter is a TreeWriter that writes to a Float or Double column type.
type FloatTreeWriter struct {
	BaseTreeWriter
	*BufferedWriter
	bytesPerValue int
}

// NewFloatTreeWriter returns a new FloatTreeWriter or an error if one occurs.
func NewFloatTreeWriter(category Category, codec CompressionCodec, bytesPerValue int) (*FloatTreeWriter, error) {
	base := NewBaseTreeWriter(category, codec)
	data := base.AddStream(proto.Stream_DATA.Enum())
	base.AddPositionRecorder(data)
	return &FloatTreeWriter{
		BaseTreeWriter: base,
		BufferedWriter: data.buffer,
		bytesPerValue:  bytesPerValue,
	}, nil
}

// Write writes a float or double value returning an error if one occurs.
func (f *FloatTreeWriter) Write(value interface{}) error {
	if err := f.BaseTreeWriter.Write(value); err != nil {
		return err
	}
	if value == nil {
		return nil
	}
	if f.bytesPerValue == 8 {
		return f.WriteDouble(value)
	}
	return f.WriteFloat(value)
}

func (f *FloatTreeWriter) WriteDouble(value interface{}) error {
	var fval float64
	switch t := value.(type) {
	case float64:
		fval = t
	case Double:
		fval = float64(t)
	default:
		return fmt.Errorf("expected float64 value, received: %T", value)
	}
	byt := make([]byte, f.bytesPerValue)
	binary.LittleEndian.PutUint64(byt, math.Float64bits(fval))
	_, err := f.BufferedWriter.Write(byt)
	if err != nil {
		return err
	}
	return nil
}

func (f *FloatTreeWriter) WriteFloat(value interface{}) error {
	var fval float32
	switch t := value.(type) {
	case float32:
		fval = t
	case Float:
		fval = float32(t)
	default:
		return fmt.Errorf("expected float32 value, received: %T", value)
	}
	byt := make([]byte, f.bytesPerValue)
	binary.LittleEndian.PutUint32(byt, math.Float32bits(fval))
	_, err := f.BufferedWriter.Write(byt)
	if err != nil {
		return err
	}
	return nil
}

func (f *FloatTreeWriter) Close() error {
	if err := f.BaseTreeWriter.Close(); err != nil {
		return err
	}
	return f.BufferedWriter.Close()
}

func (f *FloatTreeWriter) Flush() error {
	if err := f.BaseTreeWriter.Flush(); err != nil {
		return err
	}
	return f.BufferedWriter.Flush()
}

func (f *FloatTreeWriter) Encoding() *proto.ColumnEncoding {
	return &proto.ColumnEncoding{
		Kind: proto.ColumnEncoding_DIRECT.Enum(),
	}
}

const (
	// InitialDictionarySize is the initial size used when creating the dictionary.
	InitialDictionarySize = 4096
	// DictionaryEncodingThreshold is the threshold ratio of unique items to the total count of items.
	DictionaryEncodingThreshold = 0.49
)

// StringTreeWriter is a TreeWriter implementation that writes to a string type column. It dynamically selects
// the most appropriate encoding format between direct and dictionary encoding based on the cardinality of the
// values up to the first call to Flush.
type StringTreeWriter struct {
	BaseTreeWriter
	data                  *BufferedWriter
	dictionaryData        *BufferedWriter
	lengths               *BufferedWriter
	lengthsIntWriter      IntegerWriter
	dictionaryEncodedData IntegerWriter
	dictionary            *DictionaryV2
	bufferedValues        []string
	numValues             int
	modeSelected          bool
	isDictionaryEncoded   bool
	dictionarySize        uint32
}

// NewStringTreeWriter returns a new StringTreeWriter or an error if one occurs.
func NewStringTreeWriter(category Category, codec CompressionCodec) (*StringTreeWriter, error) {
	base := NewBaseTreeWriter(category, codec)
	data := base.AddStream(proto.Stream_DATA.Enum())
	base.AddPositionRecorder(data)
	lengths := base.AddStream(proto.Stream_LENGTH.Enum())
	base.AddPositionRecorder(lengths)
	s := &StringTreeWriter{
		BaseTreeWriter: base,
		data:           data.buffer,
		lengths:        lengths.buffer,
		bufferedValues: make([]string, 0),
		dictionary:     NewDictionaryV2(),
	}
	return s, nil
}

// WriteString writes a string value to the StringTreeWriter returning an error if one occurs.
func (s *StringTreeWriter) WriteString(value string) error {
	s.numValues++
	s.bufferedValues = append(s.bufferedValues, value)
	s.dictionary.add(value)
	return nil
}

// Write writes the provided value to the underlying writers. It returns an
// error if the value is not a string type or if an error occurs during writing.
func (s *StringTreeWriter) Write(value interface{}) error {
	if value == nil {
		return s.BaseTreeWriter.Write(value)
	}
	if str, ok := value.(string); ok {
		if err := s.BaseTreeWriter.Write(value); err != nil {
			return err
		}
		return s.WriteString(str)
	}
	return fmt.Errorf("expected string value, received: %T", value)
}

func (s *StringTreeWriter) Flush() error {
	return nil
}

// Close closes the underlying writes returning an error if one occurs.
func (s *StringTreeWriter) Close() error {
	if err := s.flushBufferedValues(); err != nil {
		return err
	}
	if s.isDictionaryEncoded {
		if err := s.dictionaryEncodedData.Close(); err != nil {
			return err
		}
		if err := s.dictionaryData.Close(); err != nil {
			return err
		}
	}
	if err := s.data.Close(); err != nil {
		return err
	}
	if err := s.lengthsIntWriter.Close(); err != nil {
		return err
	}
	if err := s.lengths.Close(); err != nil {
		return err
	}
	return s.BaseTreeWriter.Close()
}

func (s *StringTreeWriter) flushDictionaryValues() error {
	var err error
	// Flush the dictionary data itself to the dictionary data stream.
	dictionaryData := s.BaseTreeWriter.AddStream(proto.Stream_DICTIONARY_DATA.Enum())
	s.AddPositionRecorder(dictionaryData)
	s.dictionaryData = dictionaryData.buffer
	// Create an IntegerWriter for the dictionary encoded column and write the buffered values.
	s.dictionaryEncodedData, err = createIntegerWriter(proto.ColumnEncoding_DICTIONARY_V2, s.data, false)
	if err != nil {
		return err
	}
	s.lengthsIntWriter, err = createIntegerWriter(proto.ColumnEncoding_DICTIONARY_V2, s.lengths, false)
	if err != nil {
		return err
	}
	// Prepare the dictionary.
	s.dictionary.prepare()
	err = s.dictionary.forEach(func(value string) error {
		_, err := s.dictionaryData.Write([]byte(value))
		if err != nil {
			return err
		}
		return s.lengthsIntWriter.WriteInt(int64(len(value)))
	})
	if err != nil {
		return err
	}
	for _, value := range s.bufferedValues {
		i, ok := s.dictionary.get(value)
		if !ok {
			return fmt.Errorf("value: %s not found in dictionary", value)
		}
		err := s.dictionaryEncodedData.WriteInt(int64(i))
		if err != nil {
			return err
		}
	}
	// Finally reset to the buffered values and dictionary ready for the next stripe.
	s.bufferedValues = nil
	s.numValues = 0
	s.dictionarySize = uint32(s.dictionary.size())
	s.dictionary.reset()
	return nil
}

func (s *StringTreeWriter) flushDirectValues() error {
	var err error
	s.lengthsIntWriter, err = createIntegerWriter(proto.ColumnEncoding_DIRECT_V2, s.lengths, false)
	if err != nil {
		return err
	}
	for _, value := range s.bufferedValues {
		_, err := s.data.Write([]byte(value))
		if err != nil {
			return err
		}
		err = s.lengthsIntWriter.WriteInt(int64(len(value)))
		if err != nil {
			return err
		}
	}
	return nil
}

// flushBufferedValues iterates through the bufferedValues and writes each of them back to the writer. This is
// called immediately after the writers mode has been determined so that the values are encoded using the
// appropriate method of either direct or dictionary encoding.
func (s *StringTreeWriter) flushBufferedValues() error {
	if s.useDictionaryEncoding() {
		return s.flushDictionaryValues()
	}
	return s.flushDirectValues()
}

func (s *StringTreeWriter) useDictionaryEncoding() bool {
	// TODO: find better way to determine whether dictionary encoding should be
	// used. Currently this method is creating a new dictionary and using
	// it to check the cardinality against the threshold value.
	s.isDictionaryEncoded = float64(s.dictionary.size())/float64(s.numValues) <= DictionaryEncodingThreshold
	return s.isDictionaryEncoded
}

// Encoding returns the column encoding for the writer, either DICTIONARY_V2 or DIRECT_V2.
func (s *StringTreeWriter) Encoding() *proto.ColumnEncoding {
	if s.isDictionaryEncoded {
		return &proto.ColumnEncoding{
			Kind:           proto.ColumnEncoding_DICTIONARY_V2.Enum(),
			DictionarySize: &s.dictionarySize,
		}
	}
	return &proto.ColumnEncoding{
		Kind: proto.ColumnEncoding_DIRECT_V2.Enum(),
	}
}

type ListTreeWriter struct {
	BaseTreeWriter
	lengths IntegerWriter
	child   TreeWriter
	data    *BufferedWriter
}

func NewListTreeWriter(category Category, codec CompressionCodec, child TreeWriter) (*ListTreeWriter, error) {
	base := NewBaseTreeWriter(category, codec)
	data := base.AddStream(proto.Stream_LENGTH.Enum())
	base.AddPositionRecorder(data)
	// TODO: Inherit column encoding kind from orc.Writer ORC file version.
	columnEncoding := proto.ColumnEncoding_DIRECT_V2
	iwriter, err := createIntegerWriter(columnEncoding, data.buffer, false)
	if err != nil {
		return nil, err
	}
	l := &ListTreeWriter{
		BaseTreeWriter: base,
		lengths:        iwriter,
		child:          child,
		data:           data.buffer,
	}
	return l, nil
}

func (l *ListTreeWriter) Write(value interface{}) error {
	if err := l.BaseTreeWriter.Write(value); err != nil {
		return err
	}
	if value == nil {
		return nil
	}
	switch reflect.TypeOf(value).Kind() {
	case reflect.Slice:
		s := reflect.ValueOf(value)
		err := l.lengths.WriteInt(int64(s.Len()))
		if err != nil {
			return err
		}
		for i := 0; i < s.Len(); i++ {
			err := l.child.Write(s.Index(i).Interface())
			if err != nil {
				return err
			}
		}
		return nil
	default:
		return fmt.Errorf("expected slice, received: %T", value)
	}
}

func (l *ListTreeWriter) Flush() error {
	if err := l.lengths.Flush(); err != nil {
		return err
	}
	if err := l.child.Flush(); err != nil {
		return err
	}
	if err := l.data.Flush(); err != nil {
		return err
	}
	return l.BaseTreeWriter.Flush()
}

func (l *ListTreeWriter) Close() error {
	if err := l.lengths.Close(); err != nil {
		return err
	}
	if err := l.child.Close(); err != nil {
		return err
	}
	if err := l.data.Close(); err != nil {
		return err
	}
	return l.BaseTreeWriter.Close()
}

func (l *ListTreeWriter) Encoding() *proto.ColumnEncoding {
	return &proto.ColumnEncoding{
		Kind: proto.ColumnEncoding_DIRECT_V2.Enum(),
	}
}

type MapTreeWriter struct {
	BaseTreeWriter
	lengths IntegerWriter
	keys    TreeWriter
	values  TreeWriter
	data    *BufferedWriter
}

func NewMapTreeWriter(category Category, codec CompressionCodec, keyWriter, valueWriter TreeWriter) (*MapTreeWriter, error) {
	base := NewBaseTreeWriter(category, codec)
	data := base.AddStream(proto.Stream_LENGTH.Enum())
	base.AddPositionRecorder(data)
	// TODO: Inherit column encoding kind from orc.Writer ORC file version.
	columnEncoding := proto.ColumnEncoding_DIRECT_V2
	iwriter, err := createIntegerWriter(columnEncoding, data.buffer, false)
	if err != nil {
		return nil, err
	}
	l := &MapTreeWriter{
		BaseTreeWriter: base,
		lengths:        iwriter,
		keys:           keyWriter,
		values:         valueWriter,
		data:           data.buffer,
	}
	return l, nil
}

func (m *MapTreeWriter) Write(value interface{}) error {
	if value == nil {
		return m.BaseTreeWriter.Write(nil)
	}
	switch reflect.TypeOf(value).Kind() {
	case reflect.Map:
		mm := reflect.ValueOf(value)
		l := mm.Len()
		if l == 0 {
			return m.BaseTreeWriter.Write(nil)
		}
		if err := m.BaseTreeWriter.Write(value); err != nil {
			return err
		}
		err := m.lengths.WriteInt(int64(l))
		if err != nil {
			return err
		}
		for _, k := range mm.MapKeys() {
			err := m.keys.Write(k.Interface())
			if err != nil {
				return err
			}
			err = m.values.Write(mm.MapIndex(k).Interface())
			if err != nil {
				return err
			}
		}
		return nil
	default:
		return fmt.Errorf("received type: %T not compatible with map column type", value)
	}
}

func (m *MapTreeWriter) Flush() error {
	if err := m.lengths.Flush(); err != nil {
		return err
	}
	if err := m.keys.Flush(); err != nil {
		return err
	}
	if err := m.values.Flush(); err != nil {
		return err
	}
	if err := m.data.Flush(); err != nil {
		return err
	}
	return m.BaseTreeWriter.Flush()
}

func (m *MapTreeWriter) Close() error {
	if err := m.lengths.Close(); err != nil {
		return err
	}
	if err := m.keys.Close(); err != nil {
		return err
	}
	if err := m.values.Close(); err != nil {
		return err
	}
	if err := m.data.Close(); err != nil {
		return err
	}
	return m.BaseTreeWriter.Close()
}

func (m *MapTreeWriter) Encoding() *proto.ColumnEncoding {
	return &proto.ColumnEncoding{
		Kind: proto.ColumnEncoding_DIRECT_V2.Enum(),
	}
}

// TimestampWriter is an interface implemented by all Timestamp type writers.
type TimestampWriter interface {
	WriteTimestamp(value time.Time) error
	Close() error
	Flush() error
}

// TimestampTreeWriter is a TreeWriter implementation that writes an Timestamp type column.
type TimestampTreeWriter struct {
	BaseTreeWriter
	data               *BufferedWriter
	secondary          *BufferedWriter
	dataIntWriter      IntegerWriter
	secondaryIntWriter IntegerWriter
}

// NewTimestampTreeWriter returns a new TimestampTreeWriter.
func NewTimestampTreeWriter(category Category, codec CompressionCodec) (*TimestampTreeWriter, error) {
	base := NewBaseTreeWriter(category, codec)
	data := base.AddStream(proto.Stream_DATA.Enum())
	base.AddPositionRecorder(data)
	secondary := base.AddStream(proto.Stream_SECONDARY.Enum())
	base.AddPositionRecorder(secondary)

	dataIntWriter, err := createIntegerWriter(proto.ColumnEncoding_DIRECT_V2, data.buffer, true)
	if err != nil {
		return nil, err
	}

	secondaryIntWriter, err := createIntegerWriter(proto.ColumnEncoding_DIRECT_V2, secondary.buffer, false)
	if err != nil {
		return nil, err
	}

	return &TimestampTreeWriter{
		BaseTreeWriter:     base,
		data:               data.buffer,
		secondary:          secondary.buffer,
		dataIntWriter:      dataIntWriter,
		secondaryIntWriter: secondaryIntWriter,
	}, nil
}

// WriteTimestamp writes an Timestamp value returning an error if one occurs.
func (w *TimestampTreeWriter) WriteTimestamp(value time.Time) error {
	secs := value.Unix() - TimestampBaseSeconds
	if err := w.dataIntWriter.WriteInt(secs); err != nil {
		return err
	}

	nanos := value.Nanosecond()
	if err := w.secondaryIntWriter.WriteInt(formatNanos(int64(nanos))); err != nil {
		return err
	}
	return nil
}

// Write writes a value returning an error if one occurs. It accepts any form of
// Timestamp or a nil value for writing nulls to the stream. Any other types will
// return an error.
func (w *TimestampTreeWriter) Write(value interface{}) error {
	switch t := value.(type) {
	case nil:
		// If the value is nil, return with no error. The value is null
		// and a false value will have been written to the present stream.
		// First write the value to the present column.
		if err := w.BaseTreeWriter.Write(value); err != nil {
			return err
		}
		return nil
	case time.Time:
		// First write the value to the present column.
		//TODO: CHECK IF THIS IS THE RIGHT VALUE
		if err := w.BaseTreeWriter.Write(t); err != nil {
			return err
		}
		return w.WriteTimestamp(t)
	default:
		return fmt.Errorf("cannot write %T to Timestamp column type", t)
	}
}

// Close closes the underlying writers returning an error if one occurs.
func (w *TimestampTreeWriter) Close() error {
	if err := w.Flush(); err != nil {
		return err
	}

	if err := w.dataIntWriter.Close(); err != nil {
		return err
	}

	if err := w.data.Close(); err != nil {
		return err
	}

	if err := w.secondaryIntWriter.Close(); err != nil {
		return err
	}

	if err := w.secondary.Close(); err != nil {
		return err
	}

	return w.BaseTreeWriter.Close()
}

// Flush flushes the underlying writers returning an error if one occurs.
func (w *TimestampTreeWriter) Flush() error {
	if err := w.dataIntWriter.Flush(); err != nil {
		return err
	}

	if err := w.secondaryIntWriter.Flush(); err != nil {
		return err
	}

	return w.BaseTreeWriter.Flush()
}

// Encoding returns the column encoding used for the TimestampTreeWriter.
func (w *TimestampTreeWriter) Encoding() *proto.ColumnEncoding {
	return &proto.ColumnEncoding{
		Kind: proto.ColumnEncoding_DIRECT_V2.Enum(),
	}
}

// UnionTreeWriter is a TreeWriter implementation that can write a unionvalue column type.
type UnionTreeWriter struct {
	BaseTreeWriter
	data       *BufferedWriter
	dataWriter *RunLengthByteWriter
	children   []TreeWriter
}

// NewUnionTreeWriter returns a UnionTreeWriter using the provided io.Writer and children
// TreeWriters. It additionally returns an error if one occurs.
func NewUnionTreeWriter(category Category, codec CompressionCodec, children []TreeWriter) (*UnionTreeWriter, error) {
	base := NewBaseTreeWriter(category, codec)
	data := base.AddStream(proto.Stream_DATA.Enum())
	base.AddPositionRecorder(data)
	return &UnionTreeWriter{
		BaseTreeWriter: base,
		data:           data.buffer,
		dataWriter:     NewRunLengthByteWriter(data.buffer),
		children:       children,
	}, nil
}

// Write writes a value to the underlying child TreeWriters. It returns
// an error if one occurs.
func (s *UnionTreeWriter) WriteUnion(value UnionValue) error {
	// First write the value to the present column.
	if err := s.BaseTreeWriter.Write(value); err != nil {
		return err
	}
	if value.Tag >= len(s.children) || value.Tag < 0 {
		return fmt.Errorf("invalid tag: %v", value.Tag)
	}
	if err := s.dataWriter.WriteByte(uint8(value.Tag)); err != nil {
		return err
	}
	return s.children[value.Tag].Write(value.Value)
}

func (s *UnionTreeWriter) Write(value interface{}) error {
	if val, ok := value.(UnionValue); ok {
		return s.WriteUnion(val)
	}
	return fmt.Errorf("cannot write %T to unionvalue column type", value)
}

// Close closes the UnionTreeWriter and its child TreeWriters returning an
// error if one occurs.
func (s *UnionTreeWriter) Close() error {
	if err := s.BaseTreeWriter.Close(); err != nil {
		return err
	}
	if err := s.dataWriter.Close(); err != nil {
		return err
	}
	if err := s.data.Close(); err != nil {
		return err
	}
	for i := range s.children {
		err := s.children[i].Close()
		if err != nil {
			return err
		}
	}
	return nil
}

// Flush flushes the UnionTreeWriter and its child TreeWriters returning an
// error if one occurs.
func (s *UnionTreeWriter) Flush() error {
	if err := s.BaseTreeWriter.Flush(); err != nil {
		return err
	}
	if err := s.dataWriter.Flush(); err != nil {
		return err
	}
	if err := s.data.Flush(); err != nil {
		return err
	}
	for i := range s.children {
		err := s.children[i].Flush()
		if err != nil {
			return err
		}
	}
	return nil
}

// Encoding returns the column encoding for the UnionTreeWriter.
func (s *UnionTreeWriter) Encoding() *proto.ColumnEncoding {
	return &proto.ColumnEncoding{
		Kind: proto.ColumnEncoding_DIRECT_V2.Enum(),
	}
}

func (s *UnionTreeWriter) RecordPositions() {
	s.BaseTreeWriter.RecordPositions()
	for _, child := range s.children {
		child.RecordPositions()
	}
}

// DateTreeWriter is a TreeWriter implementation that writes an Date type column.
type DateTreeWriter struct {
	BaseTreeWriter
	data          *BufferedWriter
	dataIntWriter IntegerWriter
	encoding      *proto.ColumnEncoding_Kind
}

// NewDateTreeWriter returns a new DateTreeWriter.
func NewDateTreeWriter(category Category, codec CompressionCodec) (*DateTreeWriter, error) {
	base := NewBaseTreeWriter(category, codec)
	data := base.AddStream(proto.Stream_DATA.Enum())
	base.AddPositionRecorder(data)
	dataIntWriter, err := createIntegerWriter(proto.ColumnEncoding_DIRECT_V2, data.buffer, true)
	if err != nil {
		return nil, err
	}
	return &DateTreeWriter{
		BaseTreeWriter: base,
		data:           data.buffer,
		dataIntWriter:  dataIntWriter,
		encoding:       proto.ColumnEncoding_DIRECT_V2.Enum(),
	}, nil
}

// Encoding returns the column encoding used for the DateTreeWriter.
func (w *DateTreeWriter) Encoding() *proto.ColumnEncoding {
	return &proto.ColumnEncoding{
		Kind: w.encoding,
	}
}

// WriteDate writes an Date value returning an error if one occurs.
func (w *DateTreeWriter) WriteDate(date time.Time) error {
	daySinceEpoch := date.Truncate(24*time.Hour).Unix() / 86400
	if err := w.dataIntWriter.WriteInt(daySinceEpoch); err != nil {
		return err
	}
	return nil
}

// Write writes a value returning an error if one occurs. It accepts a time.Time
// or a nil value for writing nulls to the stream. Any other types will
// return an error.
func (w *DateTreeWriter) Write(value interface{}) error {
	switch t := value.(type) {
	case nil:
		if err := w.BaseTreeWriter.Write(value); err != nil {
			return err
		}
		return nil
	case time.Time:
		if err := w.BaseTreeWriter.Write(t); err != nil {
			return err
		}
		return w.WriteDate(t)
	default:
		return fmt.Errorf("cannot write %T to Date column type", t)
	}
}

// Close closes the underlying writers returning an error if one occurs.
func (w *DateTreeWriter) Close() error {
	if err := w.Flush(); err != nil {
		return err
	}

	if err := w.dataIntWriter.Close(); err != nil {
		return err
	}

	if err := w.data.Close(); err != nil {
		return err
	}

	return w.BaseTreeWriter.Close()
}

// Flush flushes the underlying writers returning an error if one occurs.
func (w *DateTreeWriter) Flush() error {
	if err := w.dataIntWriter.Flush(); err != nil {
		return err
	}

	return w.BaseTreeWriter.Flush()
}
