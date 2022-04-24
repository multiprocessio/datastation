package orc

import (
	"fmt"

	"github.com/scritchley/orc/proto"
)

func createTreeReader(schema *TypeDescription, s *Stripe) (TreeReader, error) {
	id := schema.getID()
	encoding, err := s.getColumn(id)
	if err != nil {
		return nil, err
	}
	switch category := schema.getCategory(); category {
	case CategoryBoolean:
		return NewBooleanTreeReader(
			s.get(streamName{id, proto.Stream_PRESENT}),
			s.get(streamName{id, proto.Stream_DATA}),
			encoding,
		)
	case CategoryByte:
		return NewByteTreeReader(
			s.get(streamName{id, proto.Stream_PRESENT}),
			s.get(streamName{id, proto.Stream_DATA}),
			encoding,
		)
	case CategoryShort, CategoryInt, CategoryLong:
		return NewIntegerTreeReader(
			s.get(streamName{id, proto.Stream_PRESENT}),
			s.get(streamName{id, proto.Stream_DATA}),
			encoding,
		)
	case CategoryFloat:
		return NewFloatTreeReader(
			4, // Byte width
			s.get(streamName{id, proto.Stream_PRESENT}),
			s.get(streamName{id, proto.Stream_DATA}),
			encoding,
		)
	case CategoryDouble:
		return NewFloatTreeReader(
			8, // Byte width
			s.get(streamName{id, proto.Stream_PRESENT}),
			s.get(streamName{id, proto.Stream_DATA}),
			encoding,
		)
	case CategoryString, CategoryVarchar, CategoryChar:
		return NewStringTreeReader(
			s.get(streamName{id, proto.Stream_PRESENT}),
			s.get(streamName{id, proto.Stream_DATA}),
			s.get(streamName{id, proto.Stream_LENGTH}),
			s.get(streamName{id, proto.Stream_DICTIONARY_DATA}),
			encoding,
		)
	case CategoryDate:
		return NewDateTreeReader(
			s.get(streamName{id, proto.Stream_PRESENT}),
			s.get(streamName{id, proto.Stream_DATA}),
			encoding,
		)
	case CategoryTimestamp:
		return NewTimestampTreeReader(
			s.get(streamName{id, proto.Stream_PRESENT}),
			s.get(streamName{id, proto.Stream_DATA}),
			s.get(streamName{id, proto.Stream_SECONDARY}),
			encoding,
		)
	case CategoryBinary:
		return NewBinaryTreeReader(
			s.get(streamName{id, proto.Stream_PRESENT}),
			s.get(streamName{id, proto.Stream_DATA}),
			s.get(streamName{id, proto.Stream_LENGTH}),
			encoding,
		)
	case CategoryDecimal:
		return NewDecimalTreeReader(
			s.get(streamName{id, proto.Stream_PRESENT}),
			s.get(streamName{id, proto.Stream_DATA}),
			s.get(streamName{id, proto.Stream_SECONDARY}),
			encoding,
			schema.precision,
			schema.scale,
		)
	case CategoryList:
		if len(schema.children) != 1 {
			return nil, fmt.Errorf("expect 1 child for list type, got: %v", len(schema.children))
		}
		valueReader, err := createTreeReader(schema.children[0], s)
		if err != nil {
			return nil, err
		}
		return NewListTreeReader(
			s.get(streamName{id, proto.Stream_PRESENT}),
			s.get(streamName{id, proto.Stream_LENGTH}),
			valueReader,
			encoding,
		)
	case CategoryMap:
		if len(schema.children) != 2 {
			return nil, fmt.Errorf("expect 2 children for map type, got: %v", len(schema.children))
		}
		keyReader, err := createTreeReader(schema.children[0], s)
		if err != nil {
			return nil, err
		}
		valueReader, err := createTreeReader(schema.children[1], s)
		if err != nil {
			return nil, err
		}
		return NewMapTreeReader(
			s.get(streamName{id, proto.Stream_PRESENT}),
			s.get(streamName{id, proto.Stream_LENGTH}),
			keyReader,
			valueReader,
			encoding,
		)
	case CategoryStruct:
		children := make(map[string]TreeReader)
		for i := range schema.children {
			child, err := createTreeReader(schema.children[i], s)
			if err != nil {
				return nil, err
			}
			children[schema.fieldNames[i]] = child
		}
		return NewStructTreeReader(
			s.get(streamName{id, proto.Stream_PRESENT}),
			children,
		)
	case CategoryUnion:
		children := make([]TreeReader, len(schema.children))
		for i := range schema.children {
			child, err := createTreeReader(schema.children[i], s)
			if err != nil {
				return nil, err
			}
			children[i] = child
		}
		return NewUnionTreeReader(
			s.get(streamName{id, proto.Stream_PRESENT}),
			s.get(streamName{id, proto.Stream_DATA}),
			children,
		)
	default:
		return nil, fmt.Errorf("unsupported type: %s", category)
	}
}
