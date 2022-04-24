package orc

import (
	"encoding/json"
)

type Float float32

func (f Float) MarshalJSON() ([]byte, error) {
	return json.Marshal(float32(f))
}
