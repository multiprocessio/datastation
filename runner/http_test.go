package runner

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_getHTTPHostPort(t *testing.T) {
	tests := []struct {
		url     string
		expTls  bool
		expHost string
		expPort string
		expErr  error
	}{
		{
			"localhost",
			false,
			"localhost",
			"80",
			nil,
		},
		{
			":80",
			false,
			"localhost",
			"80",
			nil,
		},
		{
			"http://localhost",
			false,
			"localhost",
			"80",
			nil,
		},
		{
			"https://localhost",
			true,
			"localhost",
			"443",
			nil,
		},
		{
			"https://foo.com",
			true,
			"foo.com",
			"443",
			nil,
		},
		{
			"https://foo.com:444",
			true,
			"foo.com",
			"444",
			nil,
		},
		{
			"foo.com:444",
			false,
			"foo.com",
			"444",
			nil,
		},
		{
			"/xyz",
			false,
			"localhost",
			"80",
			nil,
		},
		{
			":443/xyz",
			true,
			"localhost",
			"443",
			nil,
		},
		{
			":90/xyz",
			false,
			"localhost",
			"90",
			nil,
		},
	}

	for _, ts := range tests {
		tls, host, port, _, err := getHTTPHostPort(ts.url)
		assert.Equal(t, ts.expTls, tls, ts.url)
		assert.Equal(t, ts.expHost, host, ts.url)
		assert.Equal(t, ts.expPort, port, ts.url)
		assert.Equal(t, ts.expErr, err, ts.url)
	}
}
