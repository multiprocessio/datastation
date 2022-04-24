package openoffice

import (
	"encoding/xml"
	"time"
)

const (
	ISO8601 = "2006-01-02T15:04:05"
)

type DocumentMeta struct {
	XMLName xml.Name `xml:"urn:oasis:names:tc:opendocument:xmlns:office:1.0 document-meta"`

	Version string `xml:"office version,attr"`
	Meta    Meta   `xml:"meta"`
}

type Meta struct {
	Title string `xml:"title"`

	InitialCreator Time `xml:"initial-creator"`
	CreationDate   Time `xml:"creation-date"`

	DcCreator string `xml:"dc creator"`
	DcDate    string `xml:"dc date"`
	DcLang    string `xml:"dc language"`

	EditingCycles   int    `xml:"editing-cycles"`
	EditingDuration string `xml:"editing-duration"`

	Stats DocStats `xml:"document-statistic"`

	Generator string `xml:"generator"`

	UserDefined []struct {
		Name string `xml:"name,attr"`
		Text string `xml:",chardata"`
	} `xml:"user-defined"`
}

type DocStats struct {
	Tables     int `xml:"table-count,attr"`
	Cells      int `xml:"cell-count,attr"`
	Images     int `xml:"image-count,attr"`
	Objects    int `xml:"object-count,attr"`
	Pages      int `xml:"page-count,attr"`
	Paragraphs int `xml:"paragraph-count,attr"`
	Words      int `xml:"word-count,attr"`
	Characters int `xml:"character-count,attr"`
}

type Time string

func (s Time) Time() (t time.Time, err error) {
	return time.Parse(ISO8601, string(s))
}

func (f *ODFFile) Meta() (docMeta *DocumentMeta, err error) {
	var dm DocumentMeta

	mf, err := f.Open("meta.xml")
	if err != nil {
		return
	}
	defer mf.Close()

	d := xml.NewDecoder(mf)
	if err = d.Decode(&dm); err == nil {
		docMeta = &dm
	}
	return
}
