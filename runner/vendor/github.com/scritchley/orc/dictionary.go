package orc

// Dictionary is a data structure that holds a distinct set of string values.
type Dictionary struct {
	initialCapacity int
	values          []string
	valuemap        map[string]int
}

// NewDictionary returns a new Dictionary intialised with the provided initialCapacity.
func NewDictionary(initialCapacity int) *Dictionary {
	return &Dictionary{
		initialCapacity: initialCapacity,
		values:          make([]string, 0, initialCapacity),
		valuemap:        make(map[string]int),
	}
}

// grow increases the capacity of the Dictionary by allocating a new slice with twice
// the capacity of the existing slice and copying all existing values into the new slice.
func (d *Dictionary) grow() {
	values := make([]string, len(d.values), 2*cap(d.values))
	copy(values, d.values)
	d.values = values
}

// add adds a string value to the Dictionary returning the integer index of the value. If the
// value already exists then the index of the existing value will be returned.
func (d *Dictionary) add(value string) int {
	if i := d.get(value); i != -1 {
		return i
	}
	if cap(d.values) == len(d.values) {
		d.grow()
	}
	i := len(d.values)
	d.values = append(d.values, value)
	d.valuemap[value] = i
	return i
}

// get retrieves the index of an existing value from the Dictionary. It returns -1 if
// the value does not exist.
func (d *Dictionary) get(value string) int {
	if i, ok := d.valuemap[value]; ok {
		return i
	}
	return -1
}

// clear removes all existing values and allocates a new underlying slice and map
// with the initialCapacity of the dictionary.
func (d *Dictionary) clear() {
	d.values = make([]string, 0, d.initialCapacity)
	d.valuemap = make(map[string]int)
}

// Size returns the number of values stored in the dictionary.
func (d *Dictionary) Size() int {
	return len(d.values)
}
