# Fast JSON encoding

See [this blog
post](https://datastation.multiprocess.io/blog/2022-03-03-improving-go-json-encoding-performance-for-large-arrays-of-objects.html)
for the rational and benchmarks.

tldr; when writing an array of objects this library can speed things
up. Especially as the number of objects in the array and the number of
columns in the object grow.

## Writing a whole array at once

If you have a whole large array at once, there is a helper function
for writing it all out at once.

```go
package main

import (
	"os"
	
	"github.com/multiprocessio/go-json"
)

func main() {
	// Uses stdlib's encoding/json
	data := []interface{}{
		map[string]interface{}{"a": 1, "b": 2},
		map[string]interface{}{"a": 5, "c": 3, "d": "xyz"},
	}

	out := os.Stdout // Can be any io.Writer
	
	err := jsonutil.Encode(out, data)
	if err != nil {
		panic(err)
	}
}
```

## Streaming encoding an array

If you are streaming data, there is also support for stream encoding
with this library:


```go
package main

import (
	"os"
	
	"github.com/multiprocessio/go-json"
)

func main() {
	// Uses stdlib's encoding/json
	data := []interface{}{
		map[string]interface{}{"a": 1, "b": 2},
		map[string]interface{}{"a": 5, "c": 3, "d": "xyz"},
	}

	out := os.Stdout // Can be any io.Writer

	encoder := jsonutil.NewStreamEncoder(out, true)
	for _, row := range data {
		err := encoder.EncodeRow(row)
		if err != nil{
			panic(err)
		}
	}

	err := encoder.Close()
	if err != nil {
		panic(err)
	}
}
```
