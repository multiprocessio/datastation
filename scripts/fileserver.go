package main

import (
	"log"
	"net/http"
	"os"
)

func main() {
	port := os.Args[1]

	http.Handle("/", http.FileServer(http.Dir(".")))

	log.Printf("Serving . on HTTP port: %s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
