package orc

import (
	"bytes"
	"compress/flate"
	"encoding/binary"
	"io"
	"io/ioutil"

	"fmt"

	"github.com/golang/snappy"
)

// CompressionCodec is an interface that provides methods for creating
// an Encoder or Decoder of the CompressionCodec implementation.
type CompressionCodec interface {
	Encoder(w io.Writer) io.WriteCloser
	Decoder(r io.Reader) io.Reader
}

// CompressionNone is a CompressionCodec that implements no compression.
type CompressionNone struct{}

// Encoder implements the CompressionCodec interface.
func (c CompressionNone) Encoder(w io.Writer) io.WriteCloser {
	return &CompressionNoneEncoder{w}
}

// Decoder implements the CompressionCodec interface.
func (c CompressionNone) Decoder(r io.Reader) io.Reader {
	return r
}

type CompressionNoneEncoder struct {
	w io.Writer
}

func (c CompressionNoneEncoder) Write(p []byte) (int, error) {
	return c.w.Write(p)
}

func (c CompressionNoneEncoder) Close() error {
	return nil
}

func (c CompressionNoneEncoder) Flush() error {
	return nil
}

type CompressionZlib struct {
	Level    int
	Strategy int
}

// Encoder implements the CompressionCodec interface. This is currently not implemented.
func (c CompressionZlib) Encoder(w io.Writer) io.WriteCloser {
	return &CompressionZlibEncoder{destination: w, Level: c.Level}
}

// Decoder implements the CompressionCodec interface.
func (c CompressionZlib) Decoder(r io.Reader) io.Reader {
	return &CompressionZlibDecoder{source: r}
}

// CompressionZlibDecoder implements the CompressionCodec for Zlib compression.
type CompressionZlibDecoder struct {
	source      io.Reader
	decoded     io.Reader
	isOriginal  bool
	chunkLength int
	remaining   int64
}

func (c *CompressionZlibDecoder) readHeader() (int, error) {
	header := make([]byte, 4, 4)
	_, err := c.source.Read(header[:3])
	if err != nil {
		return 0, err
	}
	headerVal := binary.LittleEndian.Uint32(header)
	c.isOriginal = headerVal%2 == 1
	c.chunkLength = int(headerVal / 2)
	if !c.isOriginal {
		c.decoded = flate.NewReader(io.LimitReader(c.source, int64(c.chunkLength)))
	} else {
		c.decoded = io.LimitReader(c.source, int64(c.chunkLength))
	}
	return 0, nil
}

func (c *CompressionZlibDecoder) Read(p []byte) (int, error) {
	if c.decoded == nil {
		return c.readHeader()
	}
	n, err := c.decoded.Read(p)
	if err == io.EOF {
		c.decoded = nil
		return n, nil
	}
	return n, err
}

// CompressionZlibEncoder implements the CompressionCodec for Zlib compression.
type CompressionZlibEncoder struct {
	Level            int
	destination      io.Writer
	w                *flate.Writer
	compressedBuffer *bytes.Buffer
	rawBuffer        *bytes.Buffer
	cursor           int
	isOriginal       bool
}

func (c *CompressionZlibEncoder) Write(p []byte) (int, error) {
	var err error

	if c.compressedBuffer == nil {
		c.compressedBuffer = &bytes.Buffer{}
	}

	if c.rawBuffer == nil {
		c.rawBuffer = &bytes.Buffer{}
	}

	if c.w == nil {
		c.w, err = flate.NewWriter(c.compressedBuffer, c.Level)
		if err != nil {
			return 0, err
		}
	}

	n, err := c.rawBuffer.Write(p)
	if err != nil {
		return 0, err
	}

	if n != len(p) {
		return 0, fmt.Errorf("Expected to write %d bytes, wrote %d", len(p), n)
	}

	n, err = c.w.Write(p)
	return n, err
}

func (c *CompressionZlibEncoder) Close() error {
	return c.flush()
}

func (c *CompressionZlibEncoder) flush() error {
	if c.w == nil {
		//TODO: Check if this is correct
		return nil
	}

	err := c.w.Close()
	if err != nil {
		return err
	}

	defer func() {
		c.w = nil
		c.rawBuffer.Reset()
		c.rawBuffer = nil
		c.compressedBuffer.Reset()
		c.compressedBuffer = nil
	}()

	if c.compressedBuffer.Len() < c.rawBuffer.Len() {
		//COMPRESSED
		header, err := compressionHeader(c.compressedBuffer.Len(), false)
		if err != nil {
			return err
		}
		n, err := c.destination.Write(header)
		if err != nil {
			return err
		}

		if n != len(header) {
			return fmt.Errorf("Expected to write %d bytes, wrote %d", len(header), n)
		}

		l := c.compressedBuffer.Len()
		nCompressed, err := io.Copy(c.destination, c.compressedBuffer)
		if err != nil {
			return err
		}

		if int(nCompressed) != l {
			return fmt.Errorf("Expected to write %d bytes, wrote %d", l, nCompressed)
		}
	} else {
		//ORIGINAL
		header, err := compressionHeader(c.rawBuffer.Len(), true)
		if err != nil {
			return err
		}
		n, err := c.destination.Write(header)
		if err != nil {
			return err
		}

		if n != len(header) {
			return fmt.Errorf("Expected to write %d bytes, wrote %d", len(header), n)
		}

		l := c.rawBuffer.Len()
		nRaw, err := io.Copy(c.destination, c.rawBuffer)
		if err != nil {
			return err
		}

		if int(nRaw) != l {
			return fmt.Errorf("Expected to write %d bytes, wrote %d", l, nRaw)
		}
	}

	return nil
}

// CompressionSnappy implements the CompressionCodec for Snappy compression.
type CompressionSnappy struct{}

// Encoder implements the CompressionCodec interface. This is currently not implemented.
func (c CompressionSnappy) Encoder(w io.Writer) io.WriteCloser {
	return &CompressionSnappyEncoder{w}
}

// Decoder implements the CompressionCodec interface.
func (c CompressionSnappy) Decoder(r io.Reader) io.Reader {
	return &CompressionSnappyDecoder{source: r}
}

// CompressionSnappyDecoder implements the decoder for CompressionSnappy.
type CompressionSnappyDecoder struct {
	source      io.Reader
	decoded     io.Reader
	isOriginal  bool
	chunkLength int
	remaining   int64
}

func (c *CompressionSnappyDecoder) readHeader() (int, error) {
	header := make([]byte, 4, 4)
	_, err := c.source.Read(header[:3])
	if err != nil {
		return 0, err
	}
	headerVal := binary.LittleEndian.Uint32(header)
	c.isOriginal = headerVal%2 == 1
	c.chunkLength = int(headerVal / 2)
	if !c.isOriginal {
		// ORC does not use snappy's framing as implemented in the
		// github.com/golang/snappy Reader implementation. As a result
		// we have to read and decompress the entire chunk.
		// TODO: find reader implementation with optional framing.
		r := io.LimitReader(c.source, int64(c.chunkLength))
		src, err := ioutil.ReadAll(r)
		if err != nil {
			return 0, err
		}
		decodedBytes, err := snappy.Decode(nil, src)
		if err != nil {
			return 0, err
		}
		c.decoded = bytes.NewReader(decodedBytes)
	} else {
		c.decoded = io.LimitReader(c.source, int64(c.chunkLength))
	}
	return 0, nil
}

func (c *CompressionSnappyDecoder) Read(p []byte) (int, error) {
	if c.decoded == nil {
		return c.readHeader()
	}
	n, err := c.decoded.Read(p)
	if err == io.EOF || err == snappy.ErrCorrupt {
		c.decoded = nil
		return n, nil
	}
	return n, err
}

type CompressionSnappyEncoder struct {
	w io.Writer
}

func (c *CompressionSnappyEncoder) Write(p []byte) (int, error) {
	return 0, fmt.Errorf("Not implemented")
}

func (c *CompressionSnappyEncoder) Close() error {
	return fmt.Errorf("Not implemented")
}

func (c *CompressionSnappyEncoder) Flush() error {
	return fmt.Errorf("Not implemented")
}

func compressionHeader(chunkLength int, isOriginal bool) ([]byte, error) {
	if chunkLength > (1 << 23) {
		return []byte{}, fmt.Errorf("Maximum chunk length is %d bytes, got %d bytes", 1<<23, chunkLength)
	}

	i := make([]byte, 4)
	binary.LittleEndian.PutUint32(i, uint32(chunkLength)<<1)
	if isOriginal {
		i[0]++
	}

	return i[:3], nil
}
