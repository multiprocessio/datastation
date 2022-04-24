package orc

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"
	"time"

	"github.com/scritchley/orc/proto"
)

var (
	unsupportedFormat = errors.New("unsupported format")
)

// TreeReader is an interface that provides methods for reading an individual stream.
type TreeReader interface {
	Next() bool
	Value() interface{}
	Err() error
}

// BaseTreeReader wraps a *BooleanReader and is used for reading the Present stream
// in all TreeReader implementations.
type BaseTreeReader struct {
	*BooleanReader
}

// NewBaseTreeReader return a new BaseTreeReader from the provided io.Reader.
func NewBaseTreeReader(r io.Reader) BaseTreeReader {
	if r == nil {
		return BaseTreeReader{}
	}
	return BaseTreeReader{NewBooleanReader(bufio.NewReader(r))}
}

// Next returns the next available value.
func (b BaseTreeReader) Next() bool {
	if b.BooleanReader != nil {
		return b.BooleanReader.Next()
	}
	return true
}

// IsPresent returns true if a value is available and is present in the stream.
func (b BaseTreeReader) IsPresent() bool {
	if b.BooleanReader != nil {
		return b.BooleanReader.Bool()
	}
	return true
}

// Err returns the last error to occur.
func (b BaseTreeReader) Err() error {
	if b.BooleanReader != nil {
		return b.BooleanReader.Err()
	}
	return nil
}

// IntegerReader is an interface that provides methods for reading an
// integer stream that uses V1 or V2 encoding methods.
type IntegerReader interface {
	TreeReader
	Int() int64
}

// IntegerTreeReader is a TreeReader that can read Integer type streams.
type IntegerTreeReader struct {
	BaseTreeReader
	IntegerReader
}

// Next implements the TreeReader interface.
func (i *IntegerTreeReader) Next() bool {
	if !i.BaseTreeReader.Next() {
		return false
	}
	if !i.BaseTreeReader.IsPresent() {
		return true
	}
	return i.IntegerReader.Next()
}

// Value implements the TreeReader interface.
func (i *IntegerTreeReader) Value() interface{} {
	if !i.BaseTreeReader.IsPresent() {
		return nil
	}
	return i.IntegerReader.Value()
}

// Err implements the TreeReader interface.
func (i *IntegerTreeReader) Err() error {
	if err := i.IntegerReader.Err(); err != nil {
		return err
	}
	return i.BaseTreeReader.Err()
}

// NewIntegerTreeReader returns a new IntegerReader or an error if one occurs.
func NewIntegerTreeReader(present, data io.Reader, encoding *proto.ColumnEncoding) (*IntegerTreeReader, error) {
	ireader, err := createIntegerReader(encoding.GetKind(), data, true, false)
	if err != nil {
		return nil, err
	}
	return &IntegerTreeReader{
		NewBaseTreeReader(present),
		ireader,
	}, nil
}

func createIntegerReader(kind proto.ColumnEncoding_Kind, in io.Reader, signed, skipCorrupt bool) (IntegerReader, error) {
	switch kind {
	case proto.ColumnEncoding_DIRECT_V2, proto.ColumnEncoding_DICTIONARY_V2:
		return NewRunLengthIntegerReaderV2(bufio.NewReader(in), signed, skipCorrupt), nil
	case proto.ColumnEncoding_DIRECT, proto.ColumnEncoding_DICTIONARY:
		return NewRunLengthIntegerReader(bufio.NewReader(in), signed), nil
	default:
		return nil, fmt.Errorf("unknown encoding: %s", kind)
	}
}

const (
	// TimestampBaseSeconds is 1 January 2015, the base value for all timestamp values.
	TimestampBaseSeconds int64 = 1420070400
)

// TimestampTreeReader is a TreeReader implementation that reads timestamp type columns.
type TimestampTreeReader struct {
	BaseTreeReader
	data      IntegerReader
	secondary IntegerReader
}

// Next implements the TreeReader interface.
func (t *TimestampTreeReader) Next() bool {
	if !t.BaseTreeReader.Next() {
		return false
	}
	if !t.BaseTreeReader.IsPresent() {
		return true
	}
	return t.data.Next() && t.secondary.Next()
}

// ValueTimestamp returns the next timestamp value.
func (t *TimestampTreeReader) Timestamp() time.Time {
	nanos := t.secondary.Int()
	zeros := nanos & 0x7
	nanos = nanos >> 3
	if zeros != 0 {
		for i := int64(0); i <= zeros; i++ {
			nanos = nanos * 10
		}
	}
	return time.Unix(TimestampBaseSeconds+t.data.Int(), nanos).UTC()
}

// Value implements the TreeReader interface.
func (t *TimestampTreeReader) Value() interface{} {
	if !t.BaseTreeReader.IsPresent() {
		return nil
	}
	return t.Timestamp()
}

// Err implements the TreeReader interface.
func (t *TimestampTreeReader) Err() error {
	if err := t.data.Err(); err != nil {
		return err
	}
	return t.secondary.Err()
}

// NewTimestampTreeReader returns a new TimestampTreeReader along with any error that occurs.
func NewTimestampTreeReader(present, data, secondary io.Reader, encoding *proto.ColumnEncoding) (*TimestampTreeReader, error) {
	dataReader, err := createIntegerReader(encoding.GetKind(), data, true, false)
	if err != nil {
		return nil, err
	}
	secondaryReader, err := createIntegerReader(encoding.GetKind(), secondary, false, false)
	if err != nil {
		return nil, err
	}
	return &TimestampTreeReader{
		BaseTreeReader: NewBaseTreeReader(present),
		data:           dataReader,
		secondary:      secondaryReader,
	}, nil
}

// DateTreeReader is a TreeReader implementation that can read date column types.
type DateTreeReader struct {
	*IntegerTreeReader
}

// Date is a date value represented by an underlying time.Time.
type Date struct {
	time.Time
}

// Date returns the next date value as a time.Time.
func (d *DateTreeReader) Date() Date {
	return Date{time.Unix(86400*d.Int(), 0).UTC()}
}

// Value implements the TreeReader interface.
func (d *DateTreeReader) Value() interface{} {
	return d.Date()
}

// NewDateTreeReader returns a new DateTreeReader along with any error that occurs.
func NewDateTreeReader(present, data io.Reader, encoding *proto.ColumnEncoding) (*DateTreeReader, error) {
	reader, err := NewIntegerTreeReader(present, data, encoding)
	if err != nil {
		return nil, err
	}
	return &DateTreeReader{reader}, nil
}

// IntegerReader is an interface that provides methods for reading a string stream.
type StringTreeReader interface {
	TreeReader
	String() string
}

// NewStringTreeReader returns a StringTreeReader implementation along with any error that occurs.s
func NewStringTreeReader(present, data, length, dictionary io.Reader, encoding *proto.ColumnEncoding) (StringTreeReader, error) {
	switch kind := encoding.GetKind(); kind {
	case proto.ColumnEncoding_DIRECT, proto.ColumnEncoding_DIRECT_V2:
		return NewStringDirectTreeReader(present, data, length, kind)
	case proto.ColumnEncoding_DICTIONARY, proto.ColumnEncoding_DICTIONARY_V2:
		return NewStringDictionaryTreeReader(present, data, length, dictionary, encoding)
	}
	return nil, fmt.Errorf("unsupported column encoding: %s", encoding.GetKind())
}

// StringDirectTreeReader is a StringTreeReader implementation that can read direct
// encoded string type columns.
type StringDirectTreeReader struct {
	BaseTreeReader
	length IntegerReader
	data   io.Reader
	err    error
}

func NewStringDirectTreeReader(present, data, length io.Reader, kind proto.ColumnEncoding_Kind) (*StringDirectTreeReader, error) {
	ireader, err := createIntegerReader(kind, length, false, false)
	if err != nil {
		return nil, err
	}
	return &StringDirectTreeReader{
		BaseTreeReader: NewBaseTreeReader(present),
		length:         ireader,
		data:           data,
	}, nil
}

func (s *StringDirectTreeReader) Next() bool {
	if s.err != nil {
		return false
	}
	if !s.BaseTreeReader.Next() {
		return false
	}
	if !s.BaseTreeReader.IsPresent() {
		return true
	}
	return s.length.Next()
}

func (s *StringDirectTreeReader) String() string {
	l := int(s.length.Int())
	byt := make([]byte, l, l)
	if l == 0 {
		return ""
	}
	n, err := s.data.Read(byt)
	if err != nil {
		s.err = err
		return ""
	}
	if n != l {
		s.err = fmt.Errorf("read unexpected number of bytes: %v expected: %v", n, l)
		return ""
	}
	return string(byt)
}

func (s *StringDirectTreeReader) Value() interface{} {
	if !s.BaseTreeReader.IsPresent() {
		return nil
	}
	return s.String()
}

func (s *StringDirectTreeReader) Err() error {
	if s.err != nil {
		return s.err
	}
	if err := s.length.Err(); err != nil {
		return err
	}
	return s.BaseTreeReader.Err()
}

type StringDictionaryTreeReader struct {
	BaseTreeReader
	dictionaryOffsets []int
	dictionaryLength  []int
	reader            IntegerReader
	dictionaryBytes   []byte
	err               error
}

func NewStringDictionaryTreeReader(present, data, length, dictionary io.Reader, encoding *proto.ColumnEncoding) (*StringDictionaryTreeReader, error) {
	ireader, err := createIntegerReader(encoding.GetKind(), data, false, false)
	if err != nil {
		return nil, err
	}
	r := &StringDictionaryTreeReader{
		BaseTreeReader: NewBaseTreeReader(present),
		reader:         ireader,
	}
	if dictionary != nil && encoding != nil {
		err := r.readDictionaryStream(dictionary)
		if err != nil {
			return nil, err
		}
		if length != nil {
			err = r.readDictionaryLength(length, encoding)
			if err != nil {
				return nil, err
			}
		}
	}
	return r, nil
}

func (s *StringDictionaryTreeReader) readDictionaryStream(dictionary io.Reader) error {
	var buf bytes.Buffer
	_, err := io.Copy(&buf, dictionary)
	if err != nil {
		return err
	}
	s.dictionaryBytes = buf.Bytes()
	return nil
}

func (s *StringDictionaryTreeReader) readDictionaryLength(length io.Reader, encoding *proto.ColumnEncoding) error {
	lreader, err := createIntegerReader(encoding.GetKind(), length, false, false)
	if err != nil {
		return err
	}
	var offset int
	for lreader.Next() {
		l := int(lreader.Int())
		s.dictionaryLength = append(s.dictionaryLength, l)
		s.dictionaryOffsets = append(s.dictionaryOffsets, offset)
		offset += l
	}
	if err := lreader.Err(); err != nil && err != io.EOF {
		return err
	}
	return nil
}

func (s *StringDictionaryTreeReader) Next() bool {
	if s.err != nil {
		return false
	}
	if !s.BaseTreeReader.Next() {
		return false
	}
	if !s.BaseTreeReader.IsPresent() {
		return true
	}
	return s.reader.Next()
}

func (s *StringDictionaryTreeReader) getIndexLength(i int) (int, int) {
	if i >= len(s.dictionaryLength) || i < 0 {
		s.err = fmt.Errorf("invalid integer value: %v expecting values between 0...%v", i, len(s.dictionaryLength))
		return 0, 0
	}
	if i >= len(s.dictionaryOffsets) || i < 0 {
		s.err = fmt.Errorf("invalid integer value: %v expecting values between 0...%v", i, len(s.dictionaryOffsets))
		return 0, 0
	}
	return s.dictionaryOffsets[i], s.dictionaryLength[i]
}

func (s *StringDictionaryTreeReader) String() string {
	if len(s.dictionaryBytes) == 0 {
		return ""
	}
	v := s.reader.Value()
	if v == nil {
		return ""
	}
	i := v.(int64)
	offset, length := s.getIndexLength(int(i))
	if offset > len(s.dictionaryBytes) || offset+length > len(s.dictionaryBytes) {
		s.err = fmt.Errorf("invalid offset:%v or length:%v, greater than dictionary size:%v", offset, length, len(s.dictionaryBytes))
		return ""
	}
	return string(s.dictionaryBytes[offset : offset+length])
}

func (s *StringDictionaryTreeReader) Value() interface{} {
	if !s.BaseTreeReader.IsPresent() {
		return nil
	}
	return s.String()
}

func (s *StringDictionaryTreeReader) Err() error {
	if s.err != nil {
		return s.err
	}
	if err := s.reader.Err(); err != nil {
		return err
	}
	return s.BaseTreeReader.Err()
}

type BooleanTreeReader struct {
	BaseTreeReader
	*BooleanReader
}

func (b *BooleanTreeReader) Next() bool {
	if !b.BaseTreeReader.Next() {
		return false
	}
	if !b.BaseTreeReader.IsPresent() {
		return true
	}
	return b.BooleanReader.Next()
}

func (b *BooleanTreeReader) Value() interface{} {
	if !b.BaseTreeReader.IsPresent() {
		return nil
	}
	return b.Bool()
}

func (b *BooleanTreeReader) Err() error {
	if err := b.BooleanReader.Err(); err != nil {
		return err
	}
	return b.BaseTreeReader.Err()
}

func NewBooleanTreeReader(present, data io.Reader, encoding *proto.ColumnEncoding) (*BooleanTreeReader, error) {
	return &BooleanTreeReader{
		NewBaseTreeReader(present),
		NewBooleanReader(bufio.NewReader(data)),
	}, nil
}

type ByteTreeReader struct {
	BaseTreeReader
	*RunLengthByteReader
}

func (b *ByteTreeReader) Next() bool {
	if !b.BaseTreeReader.Next() {
		return false
	}
	if !b.BaseTreeReader.IsPresent() {
		return true
	}
	return b.RunLengthByteReader.Next()
}

func (b *ByteTreeReader) Value() interface{} {
	if !b.BaseTreeReader.IsPresent() {
		return nil
	}
	return b.RunLengthByteReader.Value()
}

func (b *ByteTreeReader) Err() error {
	if err := b.RunLengthByteReader.Err(); err != nil {
		return err
	}
	return b.BaseTreeReader.Err()
}

func NewByteTreeReader(present, data io.Reader, encoding *proto.ColumnEncoding) (*ByteTreeReader, error) {
	return &ByteTreeReader{
		NewBaseTreeReader(present),
		NewRunLengthByteReader(bufio.NewReader(data)),
	}, nil
}

// MapTreeReader is a TreeReader that reads from map encoded columns.
type MapTreeReader struct {
	BaseTreeReader
	length IntegerReader
	key    TreeReader
	value  TreeReader
}

// Next returns true if another row is available.
func (m *MapTreeReader) Next() bool {
	if !m.BaseTreeReader.Next() {
		return false
	}
	if !m.BaseTreeReader.IsPresent() {
		return true
	}
	return m.length.Next() && m.key.Next() && m.value.Next()
}

// MapEntry is an individual entry in a Map.
type MapEntry struct {
	Key   interface{} `json:"key"`
	Value interface{} `json:"value"`
}

// Map returns the next available row of MapEntries.
func (m *MapTreeReader) Map() []MapEntry {
	l := int(m.length.Int())
	kv := make([]MapEntry, l)
	for i := 0; i < l; i++ {
		kv[i] = MapEntry{
			Key:   m.key.Value(),
			Value: m.value.Value(),
		}
		if i-1 == l {
			break
		}
		m.key.Next()
		m.value.Next()
	}
	return kv
}

// Value implements the TreeReader interface, returning the next available row.
func (m *MapTreeReader) Value() interface{} {
	if !m.BaseTreeReader.IsPresent() {
		return nil
	}
	return m.Map()
}

// NewMapTreeReader returns a new instance of a MapTreeReader.
func NewMapTreeReader(present, length io.Reader, key, value TreeReader, encoding *proto.ColumnEncoding) (*MapTreeReader, error) {
	lengthReader, err := createIntegerReader(encoding.GetKind(), length, false, false)
	if err != nil {
		return nil, err
	}
	return &MapTreeReader{
		NewBaseTreeReader(present),
		lengthReader,
		key,
		value,
	}, nil
}

type ListTreeReader struct {
	BaseTreeReader
	length IntegerReader
	value  TreeReader
	err    error
}

func (r *ListTreeReader) Next() bool {
	if !r.BaseTreeReader.Next() {
		return false
	}
	if !r.BaseTreeReader.IsPresent() {
		return true
	}
	return r.length.Next()
}

func (r *ListTreeReader) List() []interface{} {
	l := int(r.length.Int())
	ls := make([]interface{}, l, l)
	if l == 0 {
		return ls
	}
	for i := range ls {
		if !r.value.Next() {
			if err := r.Err(); err != nil {
				r.err = err
			}
			break
		}
		ls[i] = r.value.Value()
	}
	return ls
}

func (r *ListTreeReader) Value() interface{} {
	if !r.BaseTreeReader.IsPresent() {
		return nil
	}
	return r.List()
}

func (r *ListTreeReader) Err() error {
	if r.err != nil {
		return r.err
	}
	if err := r.length.Err(); err != nil {
		return err
	}
	return r.BaseTreeReader.Err()
}

func NewListTreeReader(present, length io.Reader, value TreeReader, encoding *proto.ColumnEncoding) (*ListTreeReader, error) {
	lengthReader, err := createIntegerReader(encoding.GetKind(), length, false, false)
	if err != nil {
		return nil, err
	}
	return &ListTreeReader{
		BaseTreeReader: NewBaseTreeReader(present),
		length:         lengthReader,
		value:          value,
	}, nil
}

type StructTreeReader struct {
	BaseTreeReader
	children map[string]TreeReader
}

func (s *StructTreeReader) Next() bool {
	if !s.BaseTreeReader.Next() {
		return false
	}
	if !s.BaseTreeReader.IsPresent() {
		return true
	}
	for _, v := range s.children {
		if !v.Next() {
			return false
		}
	}
	return true
}

type Struct map[string]interface{}

func (s *StructTreeReader) Struct() Struct {
	st := make(map[string]interface{})
	for k, v := range s.children {
		st[k] = v.Value()
	}
	return st
}

func (s *StructTreeReader) Value() interface{} {
	if !s.BaseTreeReader.IsPresent() {
		return nil
	}
	return s.Struct()
}

func (s *StructTreeReader) Err() error {
	for _, child := range s.children {
		if err := child.Err(); err != nil {
			return err
		}
	}
	return s.BaseTreeReader.Err()
}

func NewStructTreeReader(present io.Reader, children map[string]TreeReader) (*StructTreeReader, error) {
	return &StructTreeReader{
		NewBaseTreeReader(present),
		children,
	}, nil
}

type FloatTreeReader struct {
	BaseTreeReader
	io.Reader
	bytesPerValue int
	err           error
}

func (r *FloatTreeReader) Next() bool {
	if !r.BaseTreeReader.Next() {
		return false
	}
	return true
}

func (r *FloatTreeReader) Float() Float {
	bs := make([]byte, r.bytesPerValue, r.bytesPerValue)
	n, err := r.Reader.Read(bs)
	if err != nil {
		r.err = err
		return 0
	}
	if n != r.bytesPerValue {
		r.err = fmt.Errorf("read unexpected number of bytes: %v, expected:%v", n, r.bytesPerValue)
		return 0
	}
	return Float(math.Float32frombits(binary.LittleEndian.Uint32(bs)))
}

// Double is ORC double type i.e. a float64.
type Double float64

// Double returns the next Double value.
func (r *FloatTreeReader) Double() Double {
	bs := make([]byte, r.bytesPerValue, r.bytesPerValue)
	n, err := r.Reader.Read(bs)
	if err != nil {
		r.err = err
		return 0
	}
	if n != r.bytesPerValue {
		r.err = fmt.Errorf("read unexpected number of bytes: %v, expected:%v", n, r.bytesPerValue)
		return 0
	}
	return Double(math.Float64frombits(binary.LittleEndian.Uint64(bs)))
}

func (r *FloatTreeReader) Value() interface{} {
	if !r.BaseTreeReader.IsPresent() {
		return nil
	}
	if r.bytesPerValue == 4 {
		return r.Float()
	}
	return r.Double()
}

func (r *FloatTreeReader) Err() error {
	if r.err != nil {
		return r.err
	}
	return r.BaseTreeReader.Err()
}

func NewFloatTreeReader(bytesPerValue int, present, data io.Reader, encoding *proto.ColumnEncoding) (*FloatTreeReader, error) {
	return &FloatTreeReader{
		BaseTreeReader: NewBaseTreeReader(present),
		Reader:         data,
		bytesPerValue:  bytesPerValue,
	}, nil
}

// BinaryTreeReader is a TreeReader that reads a Binary type column.
type BinaryTreeReader struct {
	BaseTreeReader
	length IntegerReader
	data   io.Reader
	err    error
}

func (r *BinaryTreeReader) Next() bool {
	if !r.BaseTreeReader.Next() {
		return false
	}
	if !r.BaseTreeReader.IsPresent() {
		return true
	}
	return r.length.Next()
}

func (r *BinaryTreeReader) Binary() []byte {
	l := int(r.length.Int())
	b := make([]byte, l, l)
	n, err := r.data.Read(b)
	if err != nil {
		r.err = err
	} else if n != l {
		r.err = fmt.Errorf("read unexpected number of bytes: %v, expected:%v", n, l)
	}
	return b
}

func (r *BinaryTreeReader) Value() interface{} {
	if !r.BaseTreeReader.IsPresent() {
		return nil
	}
	return r.Binary()
}

func (r *BinaryTreeReader) Err() error {
	if r.err != nil {
		return r.err
	}
	if err := r.length.Err(); err != nil {
		return err
	}
	return r.BaseTreeReader.Err()
}

func NewBinaryTreeReader(present, data, length io.Reader, encoding *proto.ColumnEncoding) (*BinaryTreeReader, error) {
	lengthReader, err := createIntegerReader(encoding.GetKind(), length, false, false)
	if err != nil {
		return nil, err
	}
	return &BinaryTreeReader{
		BaseTreeReader: NewBaseTreeReader(present),
		length:         lengthReader,
		data:           data,
	}, nil
}

// UnionTreeReader is a TreeReader that reads a Union type column.
type UnionTreeReader struct {
	BaseTreeReader
	data     *RunLengthByteReader
	children []TreeReader
	err      error
}

// NewUnionTreeReader returns a new instance of a UnionTreeReader or an error if one occurs.
func NewUnionTreeReader(present, data io.Reader, children []TreeReader) (*UnionTreeReader, error) {
	return &UnionTreeReader{
		BaseTreeReader: NewBaseTreeReader(present),
		data:           NewRunLengthByteReader(bufio.NewReader(data)),
		children:       children,
	}, nil
}

// Next returns true if another value is available.
func (u *UnionTreeReader) Next() bool {
	if !u.BaseTreeReader.Next() {
		return false
	}
	if !u.BaseTreeReader.IsPresent() {
		return true
	}
	return u.data.Next()
}

type UnionValue struct {
	Tag   int         `json:"tag"`
	Value interface{} `json:"value"`
}

// Value returns the next value as an interface{}.
func (u *UnionTreeReader) Value() interface{} {
	if !u.BaseTreeReader.IsPresent() {
		return nil
	}
	i := int(u.data.Byte())
	if i >= len(u.children) {
		u.err = fmt.Errorf("unexpected tag offset: %v expected < %v", i, len(u.children))
	}
	if u.children[i].Next() {
		return UnionValue{
			i,
			u.children[i].Value(),
		}
	}
	return fmt.Errorf("no value available in union child column: %v", i)
}

// Err returns the last error to have occurred.
func (u *UnionTreeReader) Err() error {
	if u.err != nil {
		return u.err
	}
	for _, child := range u.children {
		if err := child.Err(); err != nil {
			return err
		}
	}
	return u.BaseTreeReader.Err()
}

// DecimalTreeReader is a TreeReader that reads a Decimal type column.
type DecimalTreeReader struct {
	BaseTreeReader
	data      io.ByteReader
	secondary IntegerReader
	err       error
	nextVal   Decimal
	precision int
	scale     int
}

// NewDecimalTreeReader returns a new instances of a DecimalTreeReader or an error if one occurs.
func NewDecimalTreeReader(present, data, secondary io.Reader, encoding *proto.ColumnEncoding, precision, scale int) (*DecimalTreeReader, error) {
	ireader, err := createIntegerReader(encoding.GetKind(), secondary, true, false)
	if err != nil {
		return nil, err
	}
	return &DecimalTreeReader{
		BaseTreeReader: NewBaseTreeReader(present),
		data:           bufio.NewReader(data),
		secondary:      ireader,
		precision:      precision,
		scale:          scale,
	}, nil
}

// Next returns true if a value is available.
func (d *DecimalTreeReader) Next() bool {
	if !d.BaseTreeReader.Next() {
		return false
	}
	if !d.BaseTreeReader.IsPresent() {
		return true
	}
	if !d.secondary.Next() {
		return false
	}
	mant, err := decodeBase128Varint(d.data)
	if err != nil {
		d.err = err
		return false
	}
	d.nextVal = NewDecimal(mant, d.secondary.Int())
	return true
}

// Decimal returns the next decimal value as a float64
func (d *DecimalTreeReader) Decimal() Decimal {
	return d.nextVal
}

// Value returns the next decimal value as an interface{}
func (d *DecimalTreeReader) Value() interface{} {
	if !d.BaseTreeReader.IsPresent() {
		return nil
	}
	return d.Decimal()
}

// Err returns the last error to have occurred.
func (d *DecimalTreeReader) Err() error {
	if d.err != nil {
		return d.err
	}
	if err := d.secondary.Err(); err != nil {
		return err
	}
	return d.BaseTreeReader.Err()
}
