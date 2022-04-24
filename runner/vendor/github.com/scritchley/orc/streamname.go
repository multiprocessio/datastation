package orc

import (
	"fmt"
	"io"

	"github.com/scritchley/orc/proto"
)

type streamMap map[streamName]io.Reader

func (s streamMap) reset() {
	for k := range s {
		delete(s, k)
	}
}

func (s streamMap) set(name streamName, buf io.Reader) {
	s[name] = buf
}

func (s streamMap) get(name streamName) io.Reader {
	if b, ok := s[name]; ok {
		return b
	}
	return nil
}

type streamName struct {
	columnID int
	kind     proto.Stream_Kind
}

func (s streamName) String() string {
	return fmt.Sprintf("col:%v kind:%s", s.columnID, s.kind)
}

type streamWriterMap map[streamName]*BufferedWriter

func (s streamWriterMap) reset() {
	for k := range s {
		delete(s, k)
	}
}

func (s streamWriterMap) create(codec CompressionCodec, name streamName) *BufferedWriter {
	stream := NewBufferedWriter(codec)
	s[name] = stream
	return stream
}

func (s streamWriterMap) size() int64 {
	var total int64
	for i := range s {
		total += int64(s[i].Len())
	}
	return total
}

// Stream is an individual stream for the TreeWriter.
type Stream struct {
	kind   *proto.Stream_Kind
	buffer *BufferedWriter
}

func (s Stream) Positions() []uint64 {
	return s.buffer.Positions()
}

type writerMap map[int]TreeWriter

func (w writerMap) forEach(fn func(i int, t TreeWriter) error) error {
	for i := 0; i < len(w); i++ {
		if t, ok := w[i]; ok {
			err := fn(i, t)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (w writerMap) size() int64 {
	var size int
	for _, treeWriter := range w {
		for _, stream := range treeWriter.Streams() {
			size += stream.buffer.Len()
		}
	}
	return int64(size)
}

func (w writerMap) add(id int, t TreeWriter) {
	w[id] = t
}

func (w writerMap) encodings() []*proto.ColumnEncoding {
	encodings := make([]*proto.ColumnEncoding, len(w))
	for i := range encodings {
		encodings[i] = w[i].Encoding()
	}
	return encodings
}
