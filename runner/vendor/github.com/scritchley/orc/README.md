# orc

[![Build Status](https://travis-ci.org/scritchley/orc.svg?branch=master)](https://travis-ci.org/scritchley/orc)
[![code-coverage](http://gocover.io/_badge/code.simon-critchley.co.uk/orc)](http://gocover.io/github.com/scritchley/orc)
[![go-doc](https://godoc.org/code.simon-critchley.co.uk/orc?status.svg)](https://godoc.org/github.com/scritchley/orc)

## Project Status

This project is still a work in progress.

## Current Support

| Column Encoding           | Read | Write | Go Type                             |
|---------------------------|------|-------|-------------------------------------|
| SmallInt, Int, BigInt     | ✓    |       | int64                               |
| Float, Double             | ✓    |       | float32, float64                    |
| String, Char, and VarChar | ✓    |       | string                              |
| Boolean                   | ✓    |       | bool                                |
| TinyInt                   | ✓    |       | byte                                |
| Binary                    | ✓    |       | []byte                              |
| Decimal                   | ✓    |       | orc.Decimal                         |
| Date                      | ✓    |       | orc.Date (time.Time)                |
| Timestamp                 | ✓    |       | time.Time                           |
| Struct                    | ✓    |       | orc.Struct (map[string]interface{}) |
| List                      | ✓    |       | []interface{}                       |
| Map                       | ✓    |       | []orc.MapEntry                      |
| Union                     | ✓    |       | interface{}                         |

- The writer support is in its late stages, however, I do not recommend using it yet.

## Example

    r, err := Open("./examples/demo-12-zlib.orc")
    if err != nil {
        log.Fatal(err)
    }
    defer r.Close()
    
    // Create a new Cursor reading the provided columns.
    c := r.Select("_col0", "_col1", "_col2")

    // Iterate over each stripe in the file.
    for c.Stripes() {
        
        // Iterate over each row in the stripe.
        for c.Next() {
              
            // Retrieve a slice of interface values for the current row.
            log.Println(c.Row())
            
        }
       
    }

    if err := c.Err(); err != nil {
        log.Fatal(err)
    }
