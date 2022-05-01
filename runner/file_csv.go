package runner

import (
	"encoding/csv"
	"io"
	"os"
	"sync"

	jsonutil "github.com/multiprocessio/go-json"
)

func transformCSV(in io.Reader, out io.Writer, delimiter rune, parallelEncoding bool) error {
	r := csv.NewReader(in)
	r.Comma = delimiter
	r.FieldsPerRecord = -1
	r.ReuseRecord = !parallelEncoding

	return withJSONArrayOutWriterFile(out, func(w *jsonutil.StreamEncoder) error {
		isHeader := true
		var fields []string
		row := map[string]any{}

		recordChannel := make(chan []string, preferredParallelism)
		first := true
		var wg sync.WaitGroup
		if parallelEncoding {
			if _, err := out.Write([]byte{'['}); err != nil {
				return err
			}
			for i := 0; i < preferredParallelism; i++ {
				go encodeCSVSubroutine(&wg, out, &fields, recordChannel)
			}
		}

		for {
			record, err := r.Read()
			if err == io.EOF {
				break
			}

			if err != nil {
				return err
			}

			if isHeader {
				for _, field := range record {
					fields = append(fields, field)
				}
				isHeader = false
				continue
			}

			if parallelEncoding && !first {
				recordChannel <- record
				continue
			}

			recordToMap(row, &fields, record)

			if parallelEncoding {
				err = w.SetArray(false).EncodeRow(row) // Encode the first item here so the remaining ones can insert commas freely.
				if err != nil {
					return err
				}
				w.Close()
				first = false
				continue
			}

			err = w.EncodeRow(row)
			if err != nil {
				return err
			}
		}

		if parallelEncoding {
			for {
				if len(recordChannel) > 0 {
					continue
				} else {
					close(recordChannel)
					break
				}
			}
			wg.Wait()
			if _, err := out.Write([]byte{']'}); err != nil {
				return err
			}
		}

		return nil
	})
}

func transformCSVFile(in string, out io.Writer, delimiter rune, parallelEncoding bool) error {
	f, err := os.Open(in)
	if err != nil {
		return err
	}
	defer f.Close()

	return transformCSV(f, out, delimiter, parallelEncoding)
}

func encodeCSVSubroutine(wg *sync.WaitGroup, out io.Writer, fields *[]string, recordChannel chan []string) {
	wg.Add(1)
	defer wg.Done()
	w := jsonutil.NewGenericStreamEncoder(out, jsonMarshal, false).SetFirst(false)
	defer w.Close()
	row := map[string]any{}
	var record []string
	for {
		record = <-recordChannel
		if record != nil {
			recordToMap(row, fields, record)
			if err := w.EncodeRow(row); err != nil {
				panic(err) // could we use something like err group and just return the error as normal?
			}
		} else {
			break
		}
	}
}
