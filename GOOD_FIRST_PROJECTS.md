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
  * Example: Messagepack, BSON, CBOR, UBJSON, XML, Yaml, Avro, HDF5?
  * See https://github.com/multiprocessio/datastation/pull/215 for how this can be done in one PR
* Test out INT96 support in Parquet, add conversion to timestamp if necessary
* Build dsq, fakegen for more/every os/arch
* Add parquet, avro writers to fakegen
* Preparation for optimized internal representation of data
  * Do read/write benchmarks among MessagePack/BSON/Protobuf/Avro
  * Make sure there’s a library for every language
  * Figure out how to embed the library inside DataStation
  * Migrate all calls reading results directly to an API layer for getting panel results (in both Go and JavaScript)
    * Fix in dsq too
* More databases
  * IBM DB2, Apache Presto/Trino, Meilisearch, Apache Hive, Apache Druid, Apache Pinot, Quickwit, Couchbase, fix MongoDB, Redis, Splunk, DataDog, SumoLogic, Loggly, [New Relic](https://docs.newrelic.com/docs/apis/nerdgraph/examples/nerdgraph-nrql-tutorial), VictoriaMetrics, Impala
  * See https://github.com/multiprocessio/datastation/pull/219 for adding a database in one PR

## Medium

* Add caching to dsq
* Support zip, .tar.gz, .gz, .tar, bz2 files
* HTTP Range support for faster downloads
* Add support for FTP
