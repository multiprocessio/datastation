package runner

import (
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"os"
	"reflect"
)

type ShapeKind string

const (
	ScalarKind  ShapeKind = "scalar"
	UnknownKind           = "unknown"
	ObjectKind            = "object"
	ArrayKind             = "array"
	VariedKind            = "varied"
)

type Shape struct {
	Kind ShapeKind `json:"kind"`
	*ScalarShape
	*ObjectShape
	*ArrayShape
	*VariedShape
}

func (s *Shape) UnmarshalJSON(data []byte) error {
	var m map[string]interface{}
	err := json.Unmarshal(data, &m)
	if err != nil {
		// If these every go bad just try to reset rather than
		// crashing since there's no way to recover this.
		Logln("Bad shape (%s): %s", err, string(data))
		s.Kind = UnknownKind
		return nil
	}

	k, ok := m["kind"]
	if !ok {
		// If these every go bad just try to reset rather than
		// crashing since there's no way to recover this.
		Logln("Missing required key 'kind': %s", string(data))
		s.Kind = UnknownKind
		return nil
	}

	ks, ok := k.(string)
	if !ok {
		// If these every go bad just try to reset rather than
		// crashing since there's no way to recover this.
		Logln("Invalid 'kind', expected string: %s", string(data))
		s.Kind = UnknownKind
		return nil
	}

	s.Kind = ShapeKind(ks)
	switch s.Kind {
	case ArrayKind:
		s.ArrayShape = new(ArrayShape)
		return json.Unmarshal(data, s.ArrayShape)
	case VariedKind:
		s.VariedShape = new(VariedShape)
		return json.Unmarshal(data, s.VariedShape)
	case ObjectKind:
		s.ObjectShape = new(ObjectShape)
		return json.Unmarshal(data, s.ObjectShape)
	case ScalarKind:
		s.ScalarShape = new(ScalarShape)
		return json.Unmarshal(data, s.ScalarShape)
	case UnknownKind:
		return nil
	}

	// If these every go bad just try to reset rather than
	// crashing since there's no way to recover this.
	Logln("Invalid 'kind': %s", string(data))
	s.Kind = UnknownKind
	return nil
}

type ScalarName string

const (
	NullScalar    ScalarName = "null"
	StringScalar             = "string"
	NumberScalar             = "number"
	BooleanScalar            = "boolean"
	BigintScalar             = "bigint"
)

type ScalarShape struct {
	Name ScalarName `json:"name"`
}

type ObjectShape struct {
	Children map[string]Shape `json:"children"`
}

type ArrayShape struct {
	Children Shape `json:"children"`
}

type VariedShape struct {
	Children []Shape `json:"children"`
}

var NullShape = Shape{Kind: ScalarKind, ScalarShape: &ScalarShape{Name: NullScalar}}
var UnknownShape = Shape{Kind: UnknownKind}
var defaultShape = UnknownShape

func getNRandomUniqueElements(arraySize int, maxSampleSize int) []int {
	if maxSampleSize <= 0 || arraySize <= maxSampleSize {
		var a []int
		for i := 0; i < arraySize; i++ {
			a = append(a, i)
		}
		return a
	}

	var unique []int
outer:
	for len(unique) < maxSampleSize {
		i := rand.Intn(arraySize)
		for _, v := range unique {
			if v == i {
				continue outer
			}
		}

		unique = append(unique, i)

	}

	return unique
}

func walkVaried(varied Shape, cb func(a0 Shape) bool) {
	stack := []Shape{varied}
	for len(stack) > 0 {
		top := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		if top.Kind == VariedKind {
			for _, c := range top.VariedShape.Children {
				stack = append(stack, c)
			}
		}

		if cb(top) {
			break
		}
	}
}

func addUniqueVaried(maybeVaried Shape, shape Shape) Shape {
	if maybeVaried.Kind == VariedKind {
		varied := maybeVaried

		if len(varied.VariedShape.Children) == 0 {
			return shape
		}

		found := false
		walkVaried(varied, func(child Shape) bool {
			// Don't try to use variedMerge here, it doesn't recurse correctly.
			if shape.Kind == VariedKind {
				walkVaried(shape, func(toAddChild Shape) bool {
					if reflect.DeepEqual(child, toAddChild) {
						found = true
						return true
					}

					return false
				})

				if found {
					return true
				}
			}

			if reflect.DeepEqual(child, shape) {
				found = true
				return true
			}

			return false
		})

		// Don't add the same shape twice
		if found {
			return varied
		}
	}

	return Shape{
		Kind: VariedKind,
		VariedShape: &VariedShape{
			Children: []Shape{maybeVaried, shape},
		},
	}
}

func variedMerge(a Shape, b Shape) Shape {
	varied := Shape{Kind: VariedKind, VariedShape: &VariedShape{}}
	walkVaried(a, func(child Shape) bool {
		varied = addUniqueVaried(varied, child)
		return false
	})

	walkVaried(b, func(child Shape) bool {
		varied = addUniqueVaried(varied, child)
		return false
	})

	return varied
}

func objectMerge(a ObjectShape, b ObjectShape) ObjectShape {
	merged := ObjectShape{Children: map[string]Shape{}}

	// First check all a keys to see if they differ in b
	for key := range a.Children {
		// In both? Merge them
		if _, ok := b.Children[key]; ok {
			merged.Children[key] = shapeMerge(a.Children[key], b.Children[key])
			continue
		}

		// If they are new, they must sometimes be null/undefined
		merged.Children[key] = addUniqueVaried(a.Children[key], NullShape)
	}

	// First check all b keys to see if they are new to a
	for key := range b.Children {
		if _, ok := a.Children[key]; !ok {
			// If they are new, they must sometimes be null/undefined
			merged.Children[key] = addUniqueVaried(b.Children[key], NullShape)
			continue
		}

		// Do nothing, it's already been merged.
	}

	return merged
}

func shapeMerge(a Shape, b Shape) Shape {
	if b.Kind == ObjectKind && a.Kind == ObjectKind {
		o := objectMerge(*a.ObjectShape, *b.ObjectShape)
		return Shape{Kind: ObjectKind, ObjectShape: &o}
	}

	if b.Kind == ArrayKind && a.Kind == ArrayKind {
		return shapeMerge(a.ArrayShape.Children, b.ArrayShape.Children)
	}

	// It's possible this case isn't even possible since 'varied' is
	// something that only gets applied during post-processing here.
	if b.Kind == VariedKind && a.Kind == VariedKind {
		return variedMerge(b, a)
	}

	// Default/missing/non-scalar case shouldn't be possible
	if b.Kind == a.Kind && b.Kind != ScalarKind {
		Logln(`Missing type equality condition for %s merge: [%#v] and [%#v].`, b.Kind, a, b)
	}

	// Otherwise is a scalar or dissimilar kind so becomes varied
	return addUniqueVaried(a, b)
}

func getArrayShape(id string, raw []interface{}, sampleSize int) Shape {
	if len(raw) == 0 {
		return Shape{Kind: ArrayKind, ArrayShape: &ArrayShape{Children: UnknownShape}}
	}

	merged := GetShape(id, raw[0], sampleSize)

	for i := range getNRandomUniqueElements(len(raw), sampleSize) {
		shape := GetShape(id, raw[i], sampleSize)
		if reflect.DeepEqual(merged, shape) {
			continue
		}

		merged = shapeMerge(merged, shape)
	}

	return Shape{Kind: ArrayKind, ArrayShape: &ArrayShape{Children: merged}}
}

func GetShape(id string, value interface{}, sampleSize int) Shape {
	switch t := value.(type) {
	case []interface{}:
		return getArrayShape(id, t, sampleSize)
	case map[string]interface{}:
		o := ObjectShape{Children: map[string]Shape{}}
		for key, val := range t {
			o.Children[key] = GetShape(id, val, sampleSize)
		}

		return Shape{Kind: ObjectKind, ObjectShape: &o}
	case int, int64, float64, float32, int32, int16, int8, uint, uint64, uint32, uint8, uint16:
		return Shape{Kind: ScalarKind, ScalarShape: &ScalarShape{Name: NumberScalar}}
	case bool:
		return Shape{Kind: ScalarKind, ScalarShape: &ScalarShape{Name: BooleanScalar}}
	case string, []byte:
		return Shape{Kind: ScalarKind, ScalarShape: &ScalarShape{Name: StringScalar}}
	default:
		Logln("Skipping unknown type: %s", t)
		return UnknownShape
	}
}

func ShapeIsObjectArray(s Shape) bool {
	if s.Kind != ArrayKind {
		return false
	}

	return s.ArrayShape.Children.Kind == ObjectKind
}

func shapeAtPath(s Shape, path string) (*Shape, error) {
	pathRunes := []rune(path)

	for len(pathRunes) > 0 {
		if s.Kind != ObjectKind {
			return nil, makeErrUser(fmt.Sprintf("Path enters non-object: %s", path))
		}
		obj := s.ObjectShape.Children

		var pathPart []rune
		i := 0
		for i < len(pathRunes) {
			c := pathRunes[i]
			if c == '.' {
				// Unescape an escaped period and keep going
				if i > 0 && path[i-1] == '\\' {
					pathPart[i-1] = '.'
					i++
					continue
				}

				// Otherwise found a real period
				i++
				break
			}

			pathPart = append(pathPart, c)
			i++
		}

		pathPartS := string(pathPart)

		pathRunes = pathRunes[i:]
		var ok bool
		s, ok = obj[pathPartS]
		if !ok {
			return nil, makeErrUser(fmt.Sprintf("Path does not exist: %s", pathPartS))
		}
	}

	return &s, nil
}

const DefaultShapeMaxBytesToRead = 1_000_000 * 10 // 10 MB

// This has a real problem for data structures like:
// {
//   "a": [... more than 1MB of data ...],
//   "b": [...whatever...]
// }
// any keys after the first one will never be seen
func ShapeFromFile(file, id string, maxBytesToRead int, sampleSize int) (*Shape, error) {
	fd, err := os.Open(file)
	if err != nil {
		return nil, edse(err)
	}

	stat, err := fd.Stat()
	if err != nil {
		return nil, edse(err)
	}

	size := stat.Size()

	if size < int64(maxBytesToRead) {
		var value interface{}
		decoder := json.NewDecoder(fd)
		err := decoder.Decode(&value)
		if err != nil {
			return nil, edse(err)
		}

		s := GetShape(id, value, sampleSize)
		return &s, nil
	}

	done := false
	var f []byte
	var incomplete []byte
	inString := false

	for !done {
		buf := make([]byte, 1024)
		bytesRead, readErr := fd.Read(buf)

		read := buf[:bytesRead]
	outer:
		for i, c := range read {
			if c != '"' && inString {
				continue
			}

			switch c {
			case '"':
				var previous byte = ' '
				if i > 0 {
					previous = read[i-1]
				} else if len(f) > 0 {
					previous = f[len(f)-1]
				}

				isEscaped := previous == '\\'
				if !isEscaped {
					inString = !inString
				}
			case '{', '[':
				incomplete = append(incomplete, c)
			case ']', '}':
				if len(f)+len(read) >= maxBytesToRead {
					// Need to not count additional openings after this
					done = true
					read = read[:i]
					break outer
				}

				// Otherwise, pop it
				incomplete = incomplete[:len(incomplete)-1]
				break
			}
		}

		f = append(f, read...)

		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return nil, edse(readErr)
		}
	}

	for i := len(incomplete) - 1; i >= 0; i-- {
		last := incomplete[i]
		if last == '{' {
			f = append(f, '}')
		} else {
			f = append(f, ']')
		}
	}

	var value interface{}
	err = json.Unmarshal(f, &value)
	if err != nil {
		return nil, edse(err)
	}

	s := GetShape(id, value, sampleSize)
	return &s, nil
}
