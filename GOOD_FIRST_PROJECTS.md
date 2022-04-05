# Good First Projects

If any of these sound interesting, join #dev on
[Discord](https://discord.multiprocess.io) and say hi!

The first thing you'll be asked to do is go through one or two of the
[tutorials on DataStation](https://datastation.multiprocess.io/docs/),
and [try out dsq](https://github.com/multiprocessio/dsq).

You'll need to have this little bit of experience using DataStation
and dsq for these tasks to make sense.

## Easy

* Add a new supported file type
  * Example: Messagepack, BSON, CBOR, UBJSON, XML, Yaml, Protobuf, Avro? HDF5?
* Test out INT96 support in Parquet, add conversion to timestamp if necessary
* Build dsq, fakegen for more/every os/arch
* Preparation for optimized internal representation of data
  * Do read/write benchmarks among MessagePack/BSON/Protobuf/Avro
  * Make sure there’s a library for every language
  * Figure out how to embed the library inside DataStation
* More databases
  * IBM DB2, Neo4j, Apache Presto/Trino, Meilisearch, Apache Hive, Apache Druid, Apache Pinot, Quickwit
* Add a new supported log format
  * Example: logfmt

## Medium

* Add caching to dsq
* Add dump schema support to dsq
* Autocomplete support in the UI
* HTTP Range support for faster downloads
* Add support for FTP
* New usql cli (run queries against all DataStation supported databases in a single CLI)
* ODBC/JDBC support
* Research/benchmarks and associated blog posts
  * SQLite vs Go port of SQLite
  * SQLite vs DuckDB
  * JDBC vs native protocols
  * Regex vs lexer
  * Copying into SQLite vs vtable
  * Evaluate SQL parser libraries in JavaScript
  * Fastest way to launch a virtual machine (gvisor, firecracker, etc)
