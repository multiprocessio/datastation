package orc

import (
	"bytes"
	"fmt"
	"io"
	"sync"
)

type BufferedWriter struct {
	uncompressedBuffer *bytes.Buffer
	encodedBuffer      *bytes.Buffer
	codec              CompressionCodec
	chunkSize          int
	checkpoint         uint64
	written            uint64
	sync.Mutex
}

// NewBufferedWriter returns a new BufferedWriter using the provided
// CompressionCodec.
func NewBufferedWriter(codec CompressionCodec) *BufferedWriter {
	chunkSize := 1024
	switch codec.(type) {
	case CompressionNone:
		chunkSize = 1
	case CompressionZlib:
		chunkSize = int(DefaultCompressionChunkSize)
	}
	return &BufferedWriter{
		codec:              codec,
		uncompressedBuffer: &bytes.Buffer{},
		encodedBuffer:      &bytes.Buffer{},
		chunkSize:          chunkSize,
	}
}

// WriteByte writes a byte to the underlying buffer.
// If the desired chunk size is reached, the buffer is compressed
func (b *BufferedWriter) WriteByte(c byte) error {
	b.Lock()
	defer b.Unlock()

	if b.uncompressedBuffer.Len() == b.chunkSize {
		err := b.spill()
		if err != nil {
			return err
		}
	}
	_, err := b.uncompressedBuffer.Write([]byte{c})
	return err
}

// Write writes the provided byte slice to the underlying buffer.
// If the desired chunk size is reached, the buffer is compressed
func (b *BufferedWriter) Write(p []byte) (int, error) {
	b.Lock()
	defer b.Unlock()
	pos := 0

	var remaining int
	l := len(p)
	c := b.chunkSize - b.uncompressedBuffer.Len()
	if c > l {
		remaining = l
	} else {
		remaining = c
	}

	n, err := b.uncompressedBuffer.Write(p[pos : pos+remaining])
	if err != nil {
		return 0, err
	}
	pos += n
	l -= n

	for l != 0 {
		if err := b.spill(); err != nil {
			return 0, err
		}

		c = b.chunkSize - b.uncompressedBuffer.Len()
		if c > l {
			remaining = l
		} else {
			remaining = c
		}

		n, err = b.uncompressedBuffer.Write(p[pos : pos+remaining])
		if err != nil {
			return 0, err
		}
		pos += n
		l -= n
	}

	return pos, nil
}

// spill to the encoder to handle the compression and update the number of
// written bytes to the encoded buffer
func (b *BufferedWriter) spill() error {
	encoder := b.codec.Encoder(b.encodedBuffer)
	l := b.uncompressedBuffer.Len()
	n, err := io.Copy(encoder, b.uncompressedBuffer)
	if err != nil {
		return err
	}
	if int(n) != l {
		return fmt.Errorf("Expected to write %d bytes, wrote %d", l, n)
	}

	err = encoder.Close()
	if err != nil {
		return err
	}
	b.written += uint64(n)
	return nil
}

func (b *BufferedWriter) Positions() []uint64 {
	b.Lock()
	defer b.Unlock()

	//TODO: Do we still need the checkpoint?
	switch b.codec.(type) {
	case CompressionNone:
		checkpoint := b.checkpoint
		b.checkpoint = b.written
		return []uint64{checkpoint}
	default:
		//TODO: check if this is correct
		checkpoint := b.checkpoint
		b.checkpoint = b.written
		return []uint64{checkpoint}

		// return nil
	}
}

func (b *BufferedWriter) Flush() error {
	b.Lock()
	defer b.Unlock()

	return b.spill()
}

func (b *BufferedWriter) Read(p []byte) (int, error) {
	b.Lock()
	defer b.Unlock()

	return b.encodedBuffer.Read(p)
}

func (b *BufferedWriter) Len() int {
	b.Lock()
	defer b.Unlock()

	return b.encodedBuffer.Len()
}

// Close flushes any buffered bytes to the underlying writer.
func (b *BufferedWriter) Close() error {
	return b.spill()
}

// Reset resets the underlying encoded buffer
func (b *BufferedWriter) Reset() {
	b.Lock()
	defer b.Unlock()

	b.encodedBuffer.Reset()
}
