package runner

type ResultWriterOptions struct {
	sampleBase int
	sampleFreq int
	writer func(bufio.Writer, map[string]any) error
}

type ResultWriter struct {
	written int
	opts ResultWriterOptions
	fd *os.File
	bfd *bufio.Writer
}

func Open(f string, opts *ResultWriterOptions) (*ResultWriter, error) {
	var rw ResultWriter{}
	var err error

	if opts == nil {
		rw.opts = ResultWriterOptions{
			sampleBase: 10_000,
			sampleFreq: 1_000,
		}
	} else {
		rw.opts = *opts
	}

	rw.fd, err = openTruncate(f)
	if err != nil {
		return nil, err
	}

	rw.bfd = newBufferedWriter(rw.fd)

	return &rw, err
}

func (rw *ResultWriter) WriteMap(m map[string]any) error {
	rw.written++
	if rw.written < rw.sampleBase {
		sample
	}
}

func indexToExcelColumn(i int) string {
	i -= 1

	if i/26 > 0 {
		return indexToExcelColumn(i/26) + string(rune(i%26+65))
	}

	return string(rune(i%26 + 65))
}

func recordToMap[T any](row map[string]any, fields *[]string, record []T) {
	i := -1 // This is only set to 0 if len(record) > 0
	var el T
	for i, el = range record {
		// If the column doesn't exist, give it an Excel-style name based on its position
		if i >= len(*fields) {
			*fields = append(*fields, indexToExcelColumn(i+1))
		} else if (*fields)[i] == "" {
			// If the column exists but has no name, same thing: Excel-style name
			(*fields)[i] = indexToExcelColumn(i + 1)
		}

		(row)[(*fields)[i]] = el
	}

	// If the record has less fields than we've seen already, set all unseen fields to nil
	for _, field := range (*fields)[i+1:] {
		(row)[field] = nil
	}
}

func (rw *ResultWriter) WriteRecord[T any](r []T) error {
	m := recordToMap[T](r)
	return rw.WriteMap(m)
}

func (rw *ResultWriter) Close() {
	rw.bfd.Close()
	rw.fd.Close()
}

type ResultReader struct {
	
}
