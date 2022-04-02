package runner

import (
	"log"

	nanoid "github.com/matoous/go-nanoid/v2"
)

func debugObject(obj any) {
	b, _ := jsonMarshal(obj)
	log.Printf("%s\n", string(b))
}

func newId() string {
	id, err := nanoid.Generate("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 12)
	if err != nil {
		// This really can't be possible and would be a huge problem if it happened.
		panic(err)
	}

	return id
}
