package runner

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"math/rand"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/linkedin/goavro/v2"
	"github.com/scritchley/orc"
	"github.com/stretchr/testify/assert"
)

func Test_indexToExcelColumn(t *testing.T) {
	tests := []struct {
		input  int
		output string
	}{
		{26, "Z"},
		{51, "AY"},
		{52, "AZ"},
		{80, "CB"},
		{676, "YZ"},
		{702, "ZZ"},
		{705, "AAC"},
	}

	for _, test := range tests {
		assert.Equal(t, indexToExcelColumn(test.input), test.output)
	}
}

func Test_recordToMap(t *testing.T) {
	tests := []struct {
		fields []string
		record []string
		expect map[string]any
	}{
		{
			[]string{"a", "b"},
			[]string{"1"},
			map[string]any{"a": "1", "b": nil},
		},
		{
			[]string{"a", "b"},
			[]string{"1", "2", "3"},
			map[string]any{"a": "1", "b": "2", "C": "3"},
		},
		{
			[]string{"a", "b"},
			[]string{},
			map[string]any{"a": nil, "b": nil},
		},
		{
			[]string{},
			[]string{
				"1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
				"11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
				"21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
			},
			map[string]any{
				"A": "1", "B": "2", "C": "3", "D": "4", "E": "5", "F": "6", "G": "7", "H": "8", "I": "9", "J": "10",
				"K": "11", "L": "12", "M": "13", "N": "14", "O": "15", "P": "16", "Q": "17", "R": "18", "S": "19", "T": "20",
				"U": "21", "V": "22", "W": "23", "X": "24", "Y": "25", "Z": "26", "AA": "27", "AB": "28", "AC": "29", "AD": "30",
			},
		},
	}

	for _, test := range tests {
		m := map[string]any{}
		recordToMap(m, &test.fields, test.record)
		assert.Equal(t, test.expect, m)
	}
}
