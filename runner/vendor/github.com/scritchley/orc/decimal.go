package orc

import (
	"io"
	"math"
	"math/big"
)

// Decimal is a decimal type.
type Decimal struct {
	Int   *big.Int
	Scale int64
}

func NewDecimal(mant *big.Int, scale int64) Decimal {
	return Decimal{
		Int:   mant,
		Scale: scale,
	}
}

func (d Decimal) String() string {
	var f big.Rat
	f.SetFrac(d.Int, scaleToDenominator(d.Scale))
	return f.FloatString(int(d.Scale))
}

func (d Decimal) Float64() float64 {
	var f big.Rat
	f.SetFrac(d.Int, scaleToDenominator(d.Scale))
	fl, _ := f.Float64()
	return fl
}

func (d Decimal) Float32() float32 {
	var f big.Rat
	f.SetFrac(d.Int, scaleToDenominator(d.Scale))
	fl, _ := f.Float32()
	return fl
}

// MarshalJSON implements the json.Marshaller interface.
func (d Decimal) MarshalJSON() ([]byte, error) {
	return []byte(d.String()), nil
}

func scaleToDenominator(i int64) *big.Int {
	return big.NewInt(int64((1 / math.Pow(10, -float64(i)))))
}

// decodeBase128Varint decodes an unbounded Base128 varint
// from r, returning a big.Int or an error.
func decodeBase128Varint(r io.ByteReader) (*big.Int, error) {
	var result big.Int
	var offset int
	b := int64(0x80)
	for (b & 0x80) != 0 {
		nb, err := r.ReadByte()
		if err != nil {
			return nil, err
		}
		b = int64(nb)
		if b == -1 {
			return nil, ErrEOFUnsignedVInt
		}
		result.Or(&result, big.NewInt((b&0x7f)<<uint64(offset)))
		offset += 7
	}
	return zigzagDecodeBigInt(&result), nil
}

func zigzagDecodeBigInt(i *big.Int) *big.Int {
	var rh big.Int
	rh.Rsh(i, 1)
	var lh big.Int
	lh.Neg(i.And(i, big.NewInt(1)))
	var result big.Int
	return result.Xor(&rh, &lh)
}
