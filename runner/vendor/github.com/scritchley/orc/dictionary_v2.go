package orc

import (
	"sort"
)

// Dictionary is a data structure that holds a distinct set of string values.
type DictionaryV2 struct {
	values    []string
	valuesMap map[string]int
}

// NewDictionaryV2 returns a new DictionaryV2 intialised with the provided initialCapacity.
func NewDictionaryV2() *DictionaryV2 {
	return &DictionaryV2{
		valuesMap: make(map[string]int),
	}
}

func (d *DictionaryV2) add(value string) {
	d.valuesMap[value] = 0
}

func (d *DictionaryV2) prepare() {
	d.values = make([]string, 0, len(d.valuesMap))
	for value := range d.valuesMap {
		d.values = append(d.values, value)
	}
	sort.Strings(d.values)
	for i := range d.values {
		d.valuesMap[d.values[i]] = i
	}
}

func (d *DictionaryV2) get(value string) (int, bool) {
	if ind, ok := d.valuesMap[value]; ok {
		return ind, true
	}
	return -1, false
}

func (d *DictionaryV2) forEach(fn func(value string) error) error {
	for _, value := range d.values {
		err := fn(value)
		if err != nil {
			return err
		}
	}
	return nil
}

func (d *DictionaryV2) reset() {
	d.valuesMap = make(map[string]int)
	d.values = nil
}

func (d *DictionaryV2) size() int {
	return len(d.valuesMap)
}
