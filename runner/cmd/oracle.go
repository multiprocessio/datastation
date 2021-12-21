package main

import (
	"log"
	"database/sql"

	_ "github.com/sijms/go-ora/v2"
)

func main() {
	connStr := "oracle://test:test@localhost/XEPDB1"
	db, err := sql.Open("oracle", connStr)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	rows, err := db.Query(`SELECT 1 AS "col1", 2.3 AS "col2"`)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var i int
		var f float64
		err := rows.Scan(&i, &f)
		if err != nil {
			log.Fatal(err)
		}
		log.Println(i, f)
	}
	err = rows.Err()
	if err != nil {
		log.Fatal(err)
	}
}
