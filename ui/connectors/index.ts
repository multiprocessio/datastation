import { DatabaseConnectorInfoType } from '../../shared/state';
import { AirtableDetails } from './AirtableDetails';
import { AthenaDetails } from './AthenaDetails';
import { BigQueryDetails } from './BigQueryDetails';
import { CassandraDetails } from './CassandraDetails';
import { ElasticsearchDetails } from './ElasticsearchDetails';
import { FluxDetails } from './FluxDetails';
import { GenericDetails, GenericNoDatabaseDetails } from './GenericDetails';
import { SnowflakeDetails } from './SnowflakeDetails';
import { SQLiteDetails } from './SQLiteDetails';

export const VENDORS: {
  [k in DatabaseConnectorInfoType]: {
    name: string;
    id: DatabaseConnectorInfoType;
    details: typeof GenericDetails;
  };
} = {
  postgres: {
    name: 'PostgreSQL',
    id: 'postgres',
    details: GenericDetails,
  },
  cockroach: {
    name: 'CockroachDB',
    id: 'cockroach',
    details: GenericDetails,
  },
  timescale: {
    name: 'TimescaleDB',
    id: 'timescale',
    details: GenericDetails,
  },
  crate: {
    name: 'CrateDB',
    id: 'crate',
    details: GenericDetails,
  },
  yugabyte: {
    name: 'YugabyteDB',
    id: 'yugabyte',
    details: GenericDetails,
  },
  quest: {
    name: 'QuestDB',
    id: 'quest',
    details: GenericDetails,
  },
  mysql: {
    name: 'MySQL',
    id: 'mysql',
    details: GenericDetails,
  },
  sqlserver: {
    name: 'SQL Server',
    id: 'sqlserver',
    details: GenericDetails,
  },
  oracle: {
    name: 'Oracle',
    id: 'oracle',
    details: GenericDetails,
  },
  sqlite: {
    name: 'SQLite',
    id: 'sqlite',
    details: SQLiteDetails,
  },
  clickhouse: {
    name: 'ClickHouse',
    id: 'clickhouse',
    details: GenericNoDatabaseDetails,
  },
  snowflake: {
    name: 'Snowflake',
    id: 'snowflake',
    details: SnowflakeDetails,
  },
  elasticsearch: {
    name: 'Elasticsearch',
    id: 'elasticsearch',
    details: ElasticsearchDetails,
  },
  splunk: {
    name: 'Splunk',
    id: 'splunk',
    details: GenericDetails,
  },
  prometheus: {
    name: 'Prometheus',
    id: 'prometheus',
    details: GenericNoDatabaseDetails,
  },
  influx: {
    name: 'Influx (InfluxQL)',
    id: 'influx',
    details: GenericDetails,
  },
  'influx-flux': {
    name: 'Influx (Flux)',
    id: 'influx-flux',
    details: FluxDetails,
  },
  presto: {
    name: 'Presto',
    id: 'presto',
    details: GenericDetails,
  },
  bigquery: {
    name: 'BigQuery',
    id: 'bigquery',
    details: BigQueryDetails,
  },
  cassandra: {
    name: 'Cassandra',
    id: 'cassandra',
    details: CassandraDetails,
  },
  scylla: {
    name: 'ScyllaDB',
    id: 'scylla',
    details: CassandraDetails,
  },
  mongo: {
    name: 'MongoDB',
    id: 'mongo',
    details: GenericDetails,
  },
  athena: {
    name: 'AWS Athena',
    id: 'athena',
    details: AthenaDetails,
  },
  airtable: {
    name: 'Airtable',
    id: 'airtable',
    details: AirtableDetails,
  },
  'google-sheets': {
    name: 'Google Sheets',
    id: 'google-sheets',
    details: BigQueryDetails,
  },
};

export const VENDOR_GROUPS: Array<{
  group: string;
  vendors: Array<DatabaseConnectorInfoType>;
}> = [
  {
    group: 'Traditional',
    vendors: [
      'postgres',
      'mysql',
      'sqlserver',
      'oracle',
      'sqlite',
      'cockroach',
    ],
  },
  {
    group: 'Warehouse',
    vendors: ['snowflake', 'bigquery', 'athena'],
  },
  {
    group: 'Spreadsheets',
    vendors: ['airtable'],
  },
  {
    group: 'Document',
    vendors: ['elasticsearch', 'crate'],
  },
  {
    group: 'Time Series',
    vendors: [
      'clickhouse',
      'cassandra',
      'scylla',
      'quest',
      'timescale',
      'yugabyte',
    ],
  },
  {
    group: 'Metrics',
    vendors: ['prometheus', 'influx', 'influx-flux'],
  },
];

VENDOR_GROUPS.forEach((g) => {
  g.vendors.sort();
});
