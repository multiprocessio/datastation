package orc

import (
	"fmt"
)

func createTreeWriter(codec CompressionCodec, schema *TypeDescription, writers writerMap) (TreeWriter, error) {

	id := schema.getID()
	var treeWriter TreeWriter
	var err error
	category := schema.getCategory()
	switch category {
	case CategoryFloat:
		treeWriter, err = NewFloatTreeWriter(category, codec, 4)
		if err != nil {
			return nil, err
		}
	case CategoryDouble:
		treeWriter, err = NewFloatTreeWriter(category, codec, 8)
		if err != nil {
			return nil, err
		}
	case CategoryBoolean:
		treeWriter, err = NewBooleanTreeWriter(category, codec)
		if err != nil {
			return nil, err
		}
	case CategoryStruct:
		// Create a TreeWriter for each child of the struct column.
		var children []TreeWriter
		for _, child := range schema.children {
			childWriter, err := createTreeWriter(codec, child, writers)
			if err != nil {
				return nil, err
			}
			children = append(children, childWriter)
		}
		treeWriter, err = NewStructTreeWriter(category, codec, children)
		if err != nil {
			return nil, err
		}
	case CategoryShort, CategoryInt, CategoryLong:
		treeWriter, err = NewIntegerTreeWriter(category, codec)
		if err != nil {
			return nil, err
		}
	case CategoryVarchar, CategoryString:
		treeWriter, err = NewStringTreeWriter(category, codec)
		if err != nil {
			return nil, err
		}
	case CategoryList:
		if len(schema.children) != 1 {
			return nil, fmt.Errorf("unexpected number of children for list column, expected 1 got %v", len(schema.children))
		}
		child, err := createTreeWriter(codec, schema.children[0], writers)
		if err != nil {
			return nil, err
		}
		treeWriter, err = NewListTreeWriter(category, codec, child)
		if err != nil {
			return nil, err
		}
	case CategoryMap:
		if len(schema.children) != 2 {
			return nil, fmt.Errorf("unexpected number of children for map column, expected 2 got %v", len(schema.children))
		}
		keyWriter, err := createTreeWriter(codec, schema.children[0], writers)
		if err != nil {
			return nil, err
		}
		valueWriter, err := createTreeWriter(codec, schema.children[1], writers)
		if err != nil {
			return nil, err
		}
		treeWriter, err = NewMapTreeWriter(category, codec, keyWriter, valueWriter)
		if err != nil {
			return nil, err
		}
	case CategoryTimestamp:
		treeWriter, err = NewTimestampTreeWriter(category, codec)
		if err != nil {
			return nil, err
		}
	case CategoryUnion:
		// Create a TreeWriter for each child of the unionvalue column.
		var children []TreeWriter
		for _, child := range schema.children {
			childWriter, err := createTreeWriter(codec, child, writers)
			if err != nil {
				return nil, err
			}
			children = append(children, childWriter)
		}
		treeWriter, err = NewUnionTreeWriter(category, codec, children)
	case CategoryDate:
		treeWriter, err = NewDateTreeWriter(category, codec)
		if err != nil {
			return nil, err
		}
	default:
		return nil, fmt.Errorf("unsupported type: %s", category)
	}
	writers.add(id, treeWriter)
	// Return the TreeWriter
	return treeWriter, nil
}
