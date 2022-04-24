package orc

import (
	"time"

	"github.com/scritchley/orc/proto"
)

type statisticsMap map[int]ColumnStatistics

func NewColumnStatistics(category Category) ColumnStatistics {
	switch category {
	case CategoryInt, CategoryShort, CategoryLong:
		return NewIntegerStatistics()
	case CategoryString:
		return NewStringStatistics()
	case CategoryBoolean:
		return NewBucketStatistics()
	case CategoryTimestamp:
		return NewTimestampStatistics()
	default:
		return NewBaseStatistics()
	}
}

func (e statisticsMap) add(id int, stats ColumnStatistics) {
	if _, ok := e[id]; ok {
		e[id].Merge(stats)
	} else {
		e[id] = stats
	}
}

func (e statisticsMap) reset() {
	for k := range e {
		delete(e, k)
	}
}

func (e statisticsMap) statistics() []*proto.ColumnStatistics {
	statistics := make([]*proto.ColumnStatistics, len(e))
	for i := range statistics {
		statistics[i] = e[i].Statistics()
	}
	return statistics
}

func (e statisticsMap) merge(other statisticsMap) {
	for i := range other {
		if _, ok := e[i]; ok {
			e[i].Merge(other[i])
		} else {
			e[i] = other[i]
		}
	}
}

func (e statisticsMap) forEach(fn func(i int, c ColumnStatistics)) {
	for i := 0; i < len(e); i++ {
		s := e[i]
		fn(i, s)
	}
}

type ColumnStatistics interface {
	Statistics() *proto.ColumnStatistics
	Add(value interface{})
	Merge(other ColumnStatistics)
	Reset()
}

type BaseStatistics struct {
	*proto.ColumnStatistics
}

func NewBaseStatistics() BaseStatistics {
	var hasNull bool
	var numValues uint64
	return BaseStatistics{
		&proto.ColumnStatistics{
			NumberOfValues: &numValues,
			HasNull:        &hasNull,
		},
	}
}

func (b BaseStatistics) Add(value interface{}) {
	if hasNull := value == nil; hasNull {
		*b.HasNull = hasNull
	}
	n := b.ColumnStatistics.GetNumberOfValues() + 1
	*b.ColumnStatistics.NumberOfValues = n
}

func (b BaseStatistics) Merge(other ColumnStatistics) {
	if bs, ok := other.(BaseStatistics); ok {
		numValues := b.GetNumberOfValues() + bs.GetNumberOfValues()
		*b.NumberOfValues = numValues
	}
}

func (b BaseStatistics) Statistics() *proto.ColumnStatistics {
	return b.ColumnStatistics
}

type IntegerStatistics struct {
	BaseStatistics
	minSet bool
}

func (i *IntegerStatistics) Merge(other ColumnStatistics) {
	if is, ok := other.(*IntegerStatistics); ok {
		if is.IntStatistics.GetMaximum() > i.IntStatistics.GetMaximum() {
			i.IntStatistics.Maximum = is.IntStatistics.Maximum
		}
		if is.IntStatistics.GetMinimum() < i.IntStatistics.GetMinimum() {
			i.IntStatistics.Minimum = is.IntStatistics.Minimum
		}
		sum := i.IntStatistics.GetSum() + is.IntStatistics.GetSum()
		*i.IntStatistics.Sum = sum
		i.BaseStatistics.Merge(is.BaseStatistics)
	}
}

func (i *IntegerStatistics) Add(value interface{}) {
	if val, ok := value.(int64); ok {
		if i.IntStatistics.Maximum == nil {
			valCopy := val
			i.IntStatistics.Maximum = &valCopy
		} else if val > i.IntStatistics.GetMaximum() {
			*i.IntStatistics.Maximum = val
		}
		if !i.minSet {
			valCopy := val
			i.IntStatistics.Minimum = &valCopy
			i.minSet = true
		} else if val < i.IntStatistics.GetMinimum() {
			*i.IntStatistics.Minimum = val
		}
		sum := i.IntStatistics.GetSum() + val
		*i.IntStatistics.Sum = sum
	}
	i.BaseStatistics.Add(value)
}

func (i *IntegerStatistics) Statistics() *proto.ColumnStatistics {
	return i.ColumnStatistics
}

func (i *IntegerStatistics) Reset() {
	*i = *NewIntegerStatistics()
}

func NewIntegerStatistics() *IntegerStatistics {
	base := NewBaseStatistics()
	var sumValue int64
	base.IntStatistics = &proto.IntegerStatistics{
		Sum: &sumValue,
	}
	return &IntegerStatistics{
		BaseStatistics: base,
	}
}

type StringStatistics struct {
	BaseStatistics
	minSet bool
}

func NewStringStatistics() *StringStatistics {
	base := NewBaseStatistics()
	var sumValue int64
	base.StringStatistics = &proto.StringStatistics{
		Sum: &sumValue,
	}
	return &StringStatistics{
		BaseStatistics: base,
	}
}

func (s *StringStatistics) Merge(other ColumnStatistics) {
	if ss, ok := other.(*StringStatistics); ok {
		if ss.StringStatistics.GetMaximum() > s.StringStatistics.GetMaximum() {
			s.StringStatistics.Maximum = ss.StringStatistics.Maximum
		}
		if ss.StringStatistics.GetMinimum() < s.StringStatistics.GetMinimum() {
			s.StringStatistics.Minimum = ss.StringStatistics.Minimum
		}
		sum := s.StringStatistics.GetSum() + ss.StringStatistics.GetSum()
		*s.StringStatistics.Sum = sum
		s.BaseStatistics.Merge(ss.BaseStatistics)
	}
}

func (s *StringStatistics) Add(value interface{}) {
	if val, ok := value.(string); ok {
		if s.StringStatistics.Maximum == nil {
			valCopy := val
			s.StringStatistics.Maximum = &valCopy
		} else if val > s.StringStatistics.GetMaximum() {
			*s.StringStatistics.Maximum = val
		}
		if !s.minSet {
			valCopy := val
			s.StringStatistics.Minimum = &valCopy
			s.minSet = true
		} else if val < s.StringStatistics.GetMinimum() {
			*s.StringStatistics.Minimum = val
		}
		sum := s.StringStatistics.GetSum() + int64(len(val))
		*s.StringStatistics.Sum = sum
	}
	s.BaseStatistics.Add(value)
}

func (s *StringStatistics) Reset() {
	*s = *NewStringStatistics()
}

func (s *StringStatistics) Statistics() *proto.ColumnStatistics {
	return s.ColumnStatistics
}

type BucketStatistics struct {
	BaseStatistics
}

func NewBucketStatistics() *BucketStatistics {
	base := NewBaseStatistics()
	base.BucketStatistics = &proto.BucketStatistics{}
	return &BucketStatistics{
		base,
	}
}

// func (b *BucketStatistics) Add(value interface{}) {
// 	if t, ok := value.(bool); ok {
// 		b.BaseStatistics
// 	}
// 	b.BaseStatistics.Add(value)
// }

type TimestampStatistics struct {
	BaseStatistics
	minSet bool
}

func NewTimestampStatistics() *TimestampStatistics {
	base := NewBaseStatistics()
	var max, min, maxUTC, minUTC int64

	base.TimestampStatistics = &proto.TimestampStatistics{
		Maximum:    &max,
		Minimum:    &min,
		MaximumUtc: &maxUTC,
		MinimumUtc: &minUTC,
	}
	return &TimestampStatistics{
		BaseStatistics: base,
	}
}

func (i *TimestampStatistics) Merge(other ColumnStatistics) {
	if is, ok := other.(*TimestampStatistics); ok {
		if is.TimestampStatistics.GetMaximum() > i.TimestampStatistics.GetMaximum() {
			i.TimestampStatistics.Maximum = is.TimestampStatistics.Maximum
			i.TimestampStatistics.MaximumUtc = is.TimestampStatistics.MaximumUtc
		}
		if is.TimestampStatistics.GetMinimum() < i.TimestampStatistics.GetMinimum() {
			i.TimestampStatistics.Minimum = is.TimestampStatistics.Minimum
			i.TimestampStatistics.MinimumUtc = is.TimestampStatistics.MinimumUtc
		}
		i.BaseStatistics.Merge(is.BaseStatistics)
	}
}

func (i *TimestampStatistics) Add(value interface{}) {
	if val, ok := value.(time.Time); ok {
		if i.TimestampStatistics.Maximum == nil {
			valCopy := val.Unix()
			valUTCCopy := val.UTC().Unix()
			i.TimestampStatistics.Maximum = &valCopy
			i.TimestampStatistics.MaximumUtc = &valUTCCopy
		} else if val.After(time.Unix(i.TimestampStatistics.GetMaximum(), 0)) {
			*i.TimestampStatistics.Maximum = val.Unix()
			*i.TimestampStatistics.MaximumUtc = val.UTC().Unix()
		}
		if !i.minSet {
			valCopy := val.Unix()
			valUTCCopy := val.UTC().Unix()
			i.TimestampStatistics.Minimum = &valCopy
			i.TimestampStatistics.MinimumUtc = &valUTCCopy
			i.minSet = true
		} else if val.Before(time.Unix(i.TimestampStatistics.GetMinimum(), 0)) {
			*i.TimestampStatistics.Minimum = val.Unix()
			*i.TimestampStatistics.MinimumUtc = val.UTC().Unix()

		}
	}
	i.BaseStatistics.Add(value)
}

func (i *TimestampStatistics) Statistics() *proto.ColumnStatistics {
	return i.ColumnStatistics
}

func (i *TimestampStatistics) Reset() {
	*i = *NewTimestampStatistics()
}
