package orc

import (
	"bytes"
	"fmt"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/scritchley/orc/proto"
)

type Category struct {
	name        string
	isPrimitive bool
	typeKind    *proto.Type_Kind
}

func (c Category) String() string {
	return c.name
}

var (
	CategoryBoolean   = Category{"boolean", true, proto.Type_BOOLEAN.Enum()}
	CategoryByte      = Category{"tinyint", true, proto.Type_BYTE.Enum()}
	CategoryShort     = Category{"smallint", true, proto.Type_SHORT.Enum()}
	CategoryInt       = Category{"int", true, proto.Type_INT.Enum()}
	CategoryLong      = Category{"bigint", true, proto.Type_LONG.Enum()}
	CategoryFloat     = Category{"float", true, proto.Type_FLOAT.Enum()}
	CategoryDouble    = Category{"double", true, proto.Type_DOUBLE.Enum()}
	CategoryString    = Category{"string", true, proto.Type_STRING.Enum()}
	CategoryDate      = Category{"date", true, proto.Type_DATE.Enum()}
	CategoryTimestamp = Category{"timestamp", true, proto.Type_TIMESTAMP.Enum()}
	CategoryBinary    = Category{"binary", true, proto.Type_BINARY.Enum()}
	CategoryDecimal   = Category{"decimal", true, proto.Type_DECIMAL.Enum()}
	CategoryVarchar   = Category{"varchar", true, proto.Type_VARCHAR.Enum()}
	CategoryChar      = Category{"char", true, proto.Type_CHAR.Enum()}
	CategoryList      = Category{"array", false, proto.Type_LIST.Enum()}
	CategoryMap       = Category{"map", false, proto.Type_MAP.Enum()}
	CategoryStruct    = Category{"struct", false, proto.Type_STRUCT.Enum()}
	CategoryUnion     = Category{"uniontype", false, proto.Type_UNION.Enum()}
	Categories        = []Category{
		CategoryBoolean,
		CategoryByte,
		CategoryShort,
		CategoryInt,
		CategoryLong,
		CategoryFloat,
		CategoryDouble,
		CategoryString,
		CategoryDate,
		CategoryTimestamp,
		CategoryBinary,
		CategoryDecimal,
		CategoryVarchar,
		CategoryChar,
		CategoryList,
		CategoryMap,
		CategoryStruct,
		CategoryUnion,
	}
)

type stringPosition struct {
	value    string
	position int
	length   int
}

func NewStringPosition(value string) *stringPosition {
	value = strings.ToLower(value)
	value = strings.NewReplacer("\n", "", " ", "", "\t", "").Replace(value)
	return &stringPosition{
		value,
		0,
		utf8.RuneCountInString(value),
	}
}

func (s stringPosition) String() string {
	var buf bytes.Buffer
	buf.WriteString(`\'`)
	buf.WriteString(string([]rune(s.value)[0:s.position]))
	buf.WriteString(`^`)
	buf.WriteString(string([]rune(s.value)[s.position]))
	buf.WriteString(`\'`)
	return buf.String()
}

func (s *stringPosition) parseCategory() (Category, error) {
	start := s.position
	for s.position < s.length {
		ch := []rune(s.value)[s.position]
		if !unicode.IsLetter(rune(ch)) {
			break
		}
		s.position++
	}

	if s.position != start {
		word := strings.ToLower(string([]rune(s.value)[start:s.position]))
		for _, cat := range Categories {
			if cat.name == word {
				return cat, nil
			}
		}
	}
	return Category{}, fmt.Errorf("can't parse category at %v", s.value)
}

func (s *stringPosition) parseInt() (int, error) {
	start := s.position
	var result int
	for s.position < s.length {
		ch := []rune(s.value)[s.position]
		if !unicode.IsDigit(ch) {
			break
		}
		result = result*10 + int(ch-'0')
		s.position++
	}
	if s.position == start {
		return 0, fmt.Errorf("Missing integer at %v", s)
	}
	return result, nil
}

func (s *stringPosition) parseName() (string, error) {
	start := s.position
	for s.position < s.length {
		ch := []rune(s.value)[s.position]
		if (!unicode.IsLetter(ch) && !unicode.IsDigit(ch)) && ch != ',' && ch != '_' {
			break
		}
		s.position++
	}
	if s.position == start {
		return "", fmt.Errorf("Missing name at %v", s)
	}
	return string([]rune(s.value)[start:s.position]), nil
}

func (s *stringPosition) requireChar(required rune) error {
	if s.position >= s.length || []rune(s.value)[s.position] != required {
		return fmt.Errorf("Missing required char '%s' at position %v", string(required), s.position)
	}
	s.position += 1
	return nil
}

func (s *stringPosition) consumeChar(ch rune) bool {
	result := s.position < s.length && []rune(s.value)[s.position] == ch
	if result {
		s.position += 1
	}
	return result
}

func (s *stringPosition) parseUnion(ty *TypeDescription) error {
	err := s.requireChar('<')
	if err != nil {
		return err
	}
	consume := true
	for consume {
		t, err := s.parseType()
		if err != nil {
			return err
		}
		err = ty.addUnionChild(t)
		if err != nil {
			return err
		}
		consume = s.consumeChar(',')
	}
	err = s.requireChar('>')
	if err != nil {
		return err
	}
	return nil
}

func (s *stringPosition) parseStruct(ty *TypeDescription) error {
	err := s.requireChar('<')
	if err != nil {
		return err
	}
	consume := true
	for consume {
		fieldName, err := s.parseName()
		if err != nil {
			return err
		}
		err = s.requireChar(':')
		if err != nil {
			return err
		}
		t, err := s.parseType()
		if err != nil {
			return err
		}
		err = ty.addField(fieldName, t)
		if err != nil {
			return err
		}
		consume = s.consumeChar(',')
	}
	err = s.requireChar('>')
	if err != nil {
		return err
	}
	return nil
}

func (s *stringPosition) parseType() (*TypeDescription, error) {
	var err error
	cat, err := s.parseCategory()
	if err != nil {
		return nil, err
	}
	result, err := NewTypeDescription(SetCategory(cat))
	if err != nil {
		return nil, err
	}
	switch result.category.name {
	case CategoryBinary.name,
		CategoryBoolean.name,
		CategoryByte.name,
		CategoryDate.name,
		CategoryDouble.name,
		CategoryFloat.name,
		CategoryInt.name,
		CategoryLong.name,
		CategoryShort.name,
		CategoryString.name,
		CategoryTimestamp.name:
	case CategoryChar.name,
		CategoryVarchar.name:
		err = s.requireChar('(')
		if err != nil {
			return nil, err
		}
		length, err := s.parseInt()
		if err != nil {
			return nil, err
		}
		err = result.withMaxLength(length)
		if err != nil {
			return nil, err
		}
		err = s.requireChar(')')
		if err != nil {
			return nil, err
		}
	case CategoryDecimal.name:
		err = s.requireChar('(')
		if err != nil {
			return nil, err
		}
		precision, err := s.parseInt()
		if err != nil {
			return nil, err
		}
		err = s.requireChar(',')
		if err != nil {
			return nil, err
		}
		scale, err := s.parseInt()
		if err != nil {
			return nil, err
		}
		err = result.withScale(scale)
		if err != nil {
			return nil, err
		}
		err = result.withPrecision(precision)
		if err != nil {
			return nil, err
		}
		err = s.requireChar(')')
		if err != nil {
			return nil, err
		}
	case CategoryList.name:
		err = s.requireChar('<')
		if err != nil {
			return nil, err
		}
		k, err := s.parseType()
		if err != nil {
			return nil, err
		}
		result.children = append(result.children, k)
		err = s.requireChar('>')
		if err != nil {
			return nil, err
		}
	case CategoryMap.name:
		err = s.requireChar('<')
		if err != nil {
			return nil, err
		}
		t, err := s.parseType()
		if err != nil {
			return nil, err
		}
		result.children = append(result.children, t)
		err = s.requireChar(',')
		if err != nil {
			return nil, err
		}
		t, err = s.parseType()
		if err != nil {
			return nil, err
		}
		result.children = append(result.children, t)
		err = s.requireChar('>')
		if err != nil {
			return nil, err
		}
	case CategoryUnion.name:
		err = s.parseUnion(result)
		if err != nil {
			return nil, err
		}
	case CategoryStruct.name:
		err = s.parseStruct(result)
		if err != nil {
			return nil, err
		}
	default:
		return nil, fmt.Errorf("Unknown type %s at %s", result.category, s)
	}
	return result, nil
}

const (
	maxPrecision     = 38
	maxScale         = 38
	defaultPrecision = 38
	defaultScale     = 10
	defaultLength    = 256
)

type TypeDescription struct {
	category   Category
	parent     *TypeDescription
	children   []*TypeDescription
	fieldNames []string
	maxLength  int
	precision  int
	scale      int
	id         int
	maxId      int
}

type TypeDescriptionTransformFunc func(t *TypeDescription) error

func NewTypeDescription(fns ...TypeDescriptionTransformFunc) (*TypeDescription, error) {
	t := &TypeDescription{
		id:        -1,
		maxId:     -1,
		maxLength: defaultLength,
		precision: defaultPrecision,
		scale:     defaultScale,
	}
	for _, fn := range fns {
		err := fn(t)
		if err != nil {
			return nil, err
		}
	}
	return t, nil
}

func SetCategory(category Category) TypeDescriptionTransformFunc {
	return func(t *TypeDescription) error {
		t.category = category
		return nil
	}
}

func AddField(field string, fns ...TypeDescriptionTransformFunc) TypeDescriptionTransformFunc {
	return func(t *TypeDescription) error {
		ft, err := NewTypeDescription(fns...)
		if err != nil {
			return err
		}
		return t.addField(field, ft)
	}
}

func AddUnionChild(fns ...TypeDescriptionTransformFunc) TypeDescriptionTransformFunc {
	return func(t *TypeDescription) error {
		ut, err := NewTypeDescription(fns...)
		if err != nil {
			return err
		}
		return t.addUnionChild(ut)
	}
}

func AddChild(fns ...TypeDescriptionTransformFunc) TypeDescriptionTransformFunc {
	return func(t *TypeDescription) error {
		ut, err := NewTypeDescription(fns...)
		if err != nil {
			return err
		}
		return t.addChild(ut)
	}
}

func (t *TypeDescription) addChild(child *TypeDescription) error {
	if t.category != CategoryList && t.category != CategoryMap {
		return fmt.Errorf("Can only add child to map or list type and not %s", t.category.name)
	}
	t.children = append(t.children, child)
	child.parent = t
	return nil
}

func (t *TypeDescription) addUnionChild(child *TypeDescription) error {
	if t.category.name != CategoryUnion.name {
		return fmt.Errorf("Can only add types to union type and not %s", t.category.name)
	}
	t.children = append(t.children, child)
	child.parent = t
	return nil
}

func (t *TypeDescription) addField(field string, fieldType *TypeDescription) error {
	if t.category.name != CategoryStruct.name {
		return fmt.Errorf("Can only add fields to struct type and not %s", t.category.name)
	}
	t.fieldNames = append(t.fieldNames, field)
	t.children = append(t.children, fieldType)
	fieldType.parent = t
	return nil
}

func (t *TypeDescription) withMaxLength(maxLength int) error {
	if t.category.name != CategoryVarchar.name && t.category.name != CategoryChar.name {
		return fmt.Errorf("maxLength is only allowed on char and varchar and not %s", t.category.name)
	}
	t.maxLength = maxLength
	return nil
}

func (t *TypeDescription) withScale(scale int) error {
	if t.category.name != CategoryDecimal.name {
		return fmt.Errorf("scale is only allowed on decimal and not %s", t.category.name)
	} else if scale < 0 || scale > maxScale || scale > t.precision {
		return fmt.Errorf("scale is out of range at %v", scale)
	}
	t.scale = scale
	return nil
}

func (t *TypeDescription) withPrecision(precision int) error {
	if t.category.name != CategoryDecimal.name {
		return fmt.Errorf("precision is only allowed on decimal and not %s", t.category.name)
	} else if precision < 1 || precision > maxPrecision || t.scale > precision {
		return fmt.Errorf("precision %v is out of range of 1 .. %v", precision, t.scale)
	}
	t.precision = precision
	return nil
}

func (t *TypeDescription) Columns() []string {
	return t.fieldNames
}

func (t *TypeDescription) getID() int {
	if t.id == -1 {
		root := t
		for root.parent != nil {
			root = root.parent
		}
		root.assignIDs(0)
	}
	return t.id
}

func (t *TypeDescription) getChildrenIDs() []int {
	min := t.getID()
	max := t.maxId
	ids := make([]int, max-min, max-min)
	for i := range ids {
		ids[i] = min + i + 1
	}
	return ids
}

func (t *TypeDescription) getSubtypes() []int {
	var ids []int
	for _, child := range t.children {
		ids = append(ids, child.getID())
	}
	return ids
}

func (t *TypeDescription) getCategory() Category {
	return t.category
}

func (t *TypeDescription) assignIDs(startID int) int {
	t.id = startID
	startID++
	if t.children != nil {
		for _, child := range t.children {
			startID = child.assignIDs(startID)
		}
	}
	t.maxId = startID - 1
	return startID
}

func (t *TypeDescription) printToBuffer(buf *bytes.Buffer) {
	buf.WriteString(t.category.name)
	switch t.category.name {
	case CategoryDecimal.name:
		buf.WriteString(`(`)
		buf.WriteString(fmt.Sprint(t.precision))
		buf.WriteString(`,`)
		buf.WriteString(fmt.Sprint(t.scale))
		buf.WriteString(`)`)
	case CategoryChar.name,
		CategoryVarchar.name:
		buf.WriteString(`(`)
		buf.WriteString(fmt.Sprint(t.maxLength))
		buf.WriteString(`)`)
	case CategoryList.name,
		CategoryMap.name,
		CategoryUnion.name:
		buf.WriteString(`<`)
		for i, child := range t.children {
			if i != 0 {
				buf.WriteString(`,`)
			}
			child.printToBuffer(buf)
		}
		buf.WriteString(`>`)
	case CategoryStruct.name:
		buf.WriteString(`<`)
		for i, child := range t.children {
			if i != 0 {
				buf.WriteString(`,`)
			}
			buf.WriteString(t.fieldNames[i])
			buf.WriteString(`:`)
			child.printToBuffer(buf)
		}
		buf.WriteString(`>`)
	}
}

func (t *TypeDescription) String() string {
	var buf bytes.Buffer
	t.printToBuffer(&buf)
	return buf.String()
}

func (t *TypeDescription) printJSONToBuffer(prefix string, buf *bytes.Buffer, indent int) {
	for i := 0; i < indent; i++ {
		buf.WriteString("\t")
	}
	buf.WriteString(prefix)
	buf.WriteString("{\"category\": \"")
	buf.WriteString(t.category.name)
	buf.WriteString("\", \"id\": ")
	buf.WriteString(fmt.Sprint(t.getID()))
	buf.WriteString(", \"max\": ")
	buf.WriteString(fmt.Sprint(t.maxId))
	switch t.category.name {
	case CategoryDecimal.name:
		buf.WriteString(", \"precision\": ")
		buf.WriteString(fmt.Sprint(t.precision))
		buf.WriteString(", \"scale\": ")
		buf.WriteString(fmt.Sprint(t.scale))
	case CategoryChar.name,
		CategoryVarchar.name:
		buf.WriteString(", \"length\": ")
		buf.WriteString(fmt.Sprint(t.maxLength))
	case CategoryList.name,
		CategoryMap.name,
		CategoryUnion.name:
		buf.WriteString(", \"children\": [")
		for i, child := range t.children {
			child.printJSONToBuffer("", buf, indent)
			if i != len(t.children)-1 {
				buf.WriteString(`,`)
			}
		}
		buf.WriteString("]")
	case CategoryStruct.name:
		buf.WriteString(", \"fields\": {")
		for i, child := range t.children {
			child.printJSONToBuffer("\""+t.fieldNames[i]+"\": ", buf, indent)
			if i != len(t.children)-1 {
				buf.WriteString(`,`)
			}
		}
		buf.WriteString(`}`)
		break
	default:
		break
	}
	buf.WriteString(`}`)
}

// ToJSON returns a json encoded string of t.
func (t *TypeDescription) ToJSON() string {
	var buf bytes.Buffer
	t.printJSONToBuffer("", &buf, 0)
	return buf.String()
}

// MarshalJSON returns a json encoded byte slice of t.
func (t *TypeDescription) MarshalJSON() ([]byte, error) {
	return []byte(t.ToJSON()), nil
}

func (t *TypeDescription) GetField(fieldName string) (*TypeDescription, error) {
	fieldNames := strings.Split(fieldName, ".")
	root := fieldNames[0]
	if len(fieldNames) == 1 {
		if root == "" || root == "*" {
			return t, nil
		}
		if len(t.fieldNames) != len(t.children) {
			return nil, fmt.Errorf("no field with name: %s", fieldName)
		}
		for i, child := range t.children {
			if t.fieldNames[i] == root {
				return child, nil
			}
		}

	}
	for i, child := range t.children {
		if t.fieldNames[i] == root {
			return child.GetField(strings.Join(fieldNames[1:], "."))
		}
	}
	return nil, fmt.Errorf("no field with name: %s", fieldName)
}

func (t *TypeDescription) Type() *proto.Type {
	ids := t.getSubtypes()
	children := make([]uint32, len(ids))
	precision := uint32(t.precision)
	scale := uint32(t.scale)
	maxLength := uint32(t.maxLength)
	for i := range ids {
		children[i] = uint32(ids[i])
	}
	return &proto.Type{
		Kind:          t.category.typeKind,
		FieldNames:    t.fieldNames,
		Subtypes:      children,
		Precision:     &precision,
		Scale:         &scale,
		MaximumLength: &maxLength,
	}
}

func (t *TypeDescription) Types() []*proto.Type {
	var types []*proto.Type
	types = append(types, t.Type())
	for _, child := range t.children {
		types = append(types, child.Types()...)
	}
	return types
}

func createMap(key, value *TypeDescription) (*TypeDescription, error) {
	td, err := NewTypeDescription(
		SetCategory(CategoryMap),
	)
	if err != nil {
		return nil, err
	}
	err = td.addChild(key)
	if err != nil {
		return nil, err
	}
	err = td.addChild(value)
	if err != nil {
		return nil, err
	}
	return td, nil
}

func createList(child *TypeDescription) (*TypeDescription, error) {
	td, err := NewTypeDescription(
		SetCategory(CategoryList),
	)
	if err != nil {
		fmt.Println(err)
		return nil, err
	}
	err = td.addChild(child)
	if err != nil {
		return nil, err
	}
	return td, nil
}

func ParseSchema(schema string) (*TypeDescription, error) {
	return NewStringPosition(schema).parseType()
}
