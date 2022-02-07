# DataStation Community Edition

DataStation is an open-source data IDE for developers. It allows you
to easily build graphs and tables with data pulled from SQL databases,
logging databases, metrics databases, HTTP servers, and all kinds of
text and binary files. Need to join or munge data? Write embedded
scripts as needed in Python, JavaScript, Ruby, R, or Julia. All in one
application.

![Remote file demo](./screens/datastation-0.7.0-file-demo.gif)

## Features

In server mode:

* Create and share dashboards with coworkers behind auth
* Schedule recurring exports of dashboards

In desktop mode and server mode:

* Build reports with graphs, charts and tables
* Script against data in Python, JavaScript, Ruby, PHP, Julia, or R
* Cross-platform: Windows, macOS, and Linux
* Easily fetch your data, wherever it is
  * Databases
    * Relational
      * [MySQL](https://datastation.multiprocess.io/docs/tutorials/Query_MySQL_with_DataStation.html)
        * Same applies for MariaDB, Percona; just swap vendor
      * [PostgreSQL](https://datastation.multiprocess.io/docs/tutorials/Query_PostgreSQL_with_DataStation.html)
        * Same applies for CockroachDB, TimescaleDB, YugaByte, CrateDB, QuestDB; just swap vendor
      * [Oracle](https://datastation.multiprocess.io/docs/tutorials/Query_Oracle_with_DataStation.html)
      * [SQL Server](https://datastation.multiprocess.io/docs/tutorials/Query_SQL_Server_with_DataStation.html)
      * [SQLite](https://datastation.multiprocess.io/docs/tutorials/Query_SQLite_with_DataStation.html)
    * Warehouse
      * [BigQuery](https://datastation.multiprocess.io/docs/tutorials/Query_BigQuery_with_DataStation.html)
      * Snowflake (supported; but no tutorial yet)
    * Document
      * [Elasticsearch](https://datastation.multiprocess.io/docs/tutorials/Query_Elasticsearch_with_DataStation.html)
    * Time Series
      * [Scylla](https://datastation.multiprocess.io/docs/tutorials/Query_Scylla_with_DataStation.html)
        * Same applies for Cassandra; just swap Vendor
      * [ClickHouse](https://datastation.multiprocess.io/docs/tutorials/Query_ClickHouse_with_DataStation.html)
    * Metrics
      * [Prometheus](https://datastation.multiprocess.io/docs/tutorials/Query_Prometheus_with_DataStation.html)
      * [Influx 2.x (Flux)](https://datastation.multiprocess.io/docs/tutorials/Query_Influx_(2.x)_with_DataStation_(Flux).html)
      * [Influx 1.x (InfluxQL)](https://datastation.multiprocess.io/docs/tutorials/Query_Influx_(1.x)_with_DataStation_(InfluxQL).html)
  * Files
    * Excel
	* CSV
	* JSON (array of objects)
	* Newline-delimited JSON
	* Concatenated JSON
	* Parquet
	* ODS
	* Logs (Apache, Nginx)
  * HTTP servers

## CLI

[dsq](https://github.com/multiprocessio/dsq) is a CLI that uses
DataStation internals to allow you to run SQL queries on data files
like Excel, JSON, CSV, TSV, Parquet, etc. If you want the CLI version
of DataStation, check out dsq.

## Try out the demo

See [here](https://app.datastation.multiprocess.io/) for the free
online demo.

It uses in-memory evaluation so your data never leaves your
machine/browser. Because it runs in browser memory it has some
limitations that the desktop and server versions don't.

## Install

Install instructions are available [here](https://datastation.multiprocess.io/docs/latest/Installation.html).

## Documentation

See [here](https://datastation.multiprocess.io/docs/) for details.

## Community

[Join us on Discord](https://discord.gg/f2wQBc4bXX).

## How can I help?

Download the app and use it! Report bugs on
[Discord](https://discord.gg/f2wQBc4bXX).

Read about the architecture in [ARCHITECTURE.md](ARCHITECTURE.md). And
if you want to make a fix, see [HACKING.md](HACKING.md).

Before starting on any new feature though, check in on
[Discord](https://discord.gg/f2wQBc4bXX)!

## Subscribe

If you want to hear about new features and how DataStation works under
the hood, [sign up here](https://forms.gle/wH5fdxrxXwZHoNxk8).

## License

This software is licensed under an Apache 2.0 license.
