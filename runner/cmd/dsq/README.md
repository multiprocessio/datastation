# dsq: Run SQL queries against data files

## Install

Get Go 1.17+ and then run:

```bash
$ go install github.com/multiprocessio/datastation/runner/cmd/dsq@latest
```

## Usage

You can either pipe data to `dsq` or you can pass a file name to it.

When piping data to `dsq` you need to specify the file extension of MIME type.

For example:

```
cat testdata.csv | dsq csv "SELECT * FROM {} LIMIT 1"
```

Or:

```
cat testdata.parquet | dsq parquet "SELECT COUNT(1) FROM {}"
```

If you are passing a file, it must have the usual extension for its
content type.

For example:

```
dsq testdata.json "SELECT * FROM {} WHERE x > 10"
```

Or:

```
dsq testdata.ndjson "SELECT name, AVG(time) FROM {} GROUP BY name ORDER BY AVG(time) DESC"
```

## Supported Data Types

| Name | File Extension(s) | Notes |
-----------------------------------|
| CSV | `csv` ||
| JSON | `json` | Must be an array of objects. Nested object fields are ignored. |
| Newline-delimited JSON | `ndjson`, `jsonl` ||
| Parquet | `parquet` ||
| Excel | `xlsx`, `xls` | Currently only works if there is only one sheet. |
| Apache Error Logs | `text/apache2error` | Currently only works if being piped in. |
| Apache Access Logs | `text/apache2access` | Currently only works if being piped in. |
| Nginx Access Logs | `text/nginxaccess` | Currently only works if being piped in. |

## Engine

Under the hood dsq uses DataStation as a library and under that hood
DataStation uses SQLite to power these kinds of SQL queries on
arbitrary (structured) data.

## License, support, community, whatnot

See the repo's main [README.md](/README.md) for the details.