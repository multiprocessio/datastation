package orc

import (
	"fmt"
	"io"
	"io/ioutil"

	gproto "github.com/golang/protobuf/proto"

	"github.com/scritchley/orc/proto"
)

// Cursor is used for iterating through the stripes and
// rows within the ORC file.
type Cursor struct {
	*Reader
	*Stripe
	columns      []*TypeDescription
	included     []int
	readers      []TreeReader
	nextVal      []interface{}
	currentRow   int
	err          error
	stripeOffset int
}

// Select determines the columns that will be read from the ORC file.
// Only streams for the selected columns will be loaded into memory.
func (c *Cursor) Select(fields ...string) *Cursor {
	var columns []*TypeDescription
	var included []int
	for _, field := range fields {
		column, err := c.Reader.schema.GetField(field)
		if err != nil {
			c.err = err
			return c
		}
		columns = append(columns, column)
		included = append(included, column.getID())
		included = append(included, column.getChildrenIDs()...)
	}
	c.columns = columns
	c.included = included
	return c
}

// SelectStripe retrieves the stream information for the specified stripe.
func (c *Cursor) SelectStripe(n int) error {
	stripe, err := c.Reader.getStripe(n, c.included...)
	if err != nil {
		return err
	}
	c.Stripe = stripe
	c.stripeOffset = n
	return c.prepareStreamReaders()
}

// prepareStreamReaders prepares TreeReaders for each of the columns
// that will be read.
func (c *Cursor) prepareStreamReaders() error {
	var readers []TreeReader
	for _, column := range c.columns {
		reader, err := createTreeReader(column, c.Stripe)
		if err != nil {
			return err
		}
		readers = append(readers, reader)
	}
	c.readers = readers
	return nil
}

// prepareNextStripe retrieves the stream information for the next stripe.
func (c *Cursor) prepareNextStripe() error {
	// Prepare the next stripe by loading it into memory
	// and creating the required readers for each of the
	// required columns.
	var err error
	stripe, err := c.Reader.getStripe(c.stripeOffset, c.included...)
	if err != nil {
		return err
	}
	c.Stripe = stripe
	c.stripeOffset++ // Increment in order to fetch the next stripe.
	return c.prepareStreamReaders()
}

// Next returns true if another set of records are available.
func (c *Cursor) Next() bool {
	// If readers have values available return true.
	if c.next() {
		c.row()
		return true
	}
	return false
}

// next returns true if all readers return that another row is available.
func (c *Cursor) next() bool {
	// If there is an error then return false.
	if c.err != nil {
		return false
	}
	// If there are no readers then return false.
	if len(c.readers) == 0 {
		return false
	}
	if c.currentRow >= int(c.Stripe.GetNumberOfRows()) {
		return false
	}
	var hasNext bool
	for _, reader := range c.readers {
		if reader.Next() {
			hasNext = true
		} else if err := reader.Err(); err != nil && err != io.EOF {
			return false
		}
	}
	c.currentRow++
	return hasNext
}

// row preallocates the next row of values and stores in nextVal.
func (c *Cursor) row() {
	c.nextVal = make([]interface{}, len(c.readers), len(c.readers))
	for i, reader := range c.readers {
		c.nextVal[i] = reader.Value()
	}
}

// Row returns the next row of values.
func (c *Cursor) Row() []interface{} {
	return c.nextVal
}

// Scan assigns the values returned by the readers to the destination slice.
func (c *Cursor) Scan(dest ...interface{}) error {
	if len(dest) != len(c.readers) {
		return fmt.Errorf("expected destination slice of length %v got %v", len(c.readers), len(dest))
	}
	for i, v := range c.nextVal {
		dest[i] = v
	}
	return nil
}

// Err returns the last error to have occurred.
func (c *Cursor) Err() error {
	if c.err == io.EOF {
		return nil
	}
	// Check whether there is already an error.
	if c.err != nil {
		return c.err
	}
	// Otherwise, return the first error returned by the readers.
	for _, reader := range c.readers {
		if err := reader.Err(); err != nil && err != io.EOF {
			return err
		}
	}
	return nil
}

// Stripes prepares the next stripe for reading, returning true once its ready. It
// returns false if an error occurs whilst preparing the stripe.
func (c *Cursor) Stripes() bool {
	// Prepare the next stripe for reading.
	err := c.prepareNextStripe()
	if err != nil {
		c.err = err
		return false
	}
	c.currentRow = 0
	return true
}

// RowIndex returns the row index for the provided column from the current strip
func (c *Cursor) RowIndex(column string) (*proto.RowIndex, error) {
	col, err := c.Reader.schema.GetField(column)
	if err != nil {
		return nil, err
	}
	stream := c.Stripe.get(streamName{
		columnID: col.getID(),
		kind:     proto.Stream_ROW_INDEX,
	})
	var rowIndex proto.RowIndex
	byt, err := ioutil.ReadAll(stream)
	if err != nil {
		return nil, err
	}
	err = gproto.Unmarshal(byt, &rowIndex)
	if err != nil {
		return nil, err
	}
	return &rowIndex, nil
}
