import { DatabaseConnectorInfoType } from '../../shared/state';
import { ElasticsearchDetails } from './ElasticsearchDetails';
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
    name: 'Influx',
    id: 'influx',
    details: GenericDetails,
  },
  presto: {
    name: 'Presto',
    id: 'presto',
    details: GenericDetails,
  },
  cassandra: {
    name: 'Cassandra',
    id: 'cassandra',
    details: GenericDetails,
  },
};

export const VENDOR_GROUPS: Array<{
  group: string;
  vendors: Array<DatabaseConnectorInfoType>;
}> = [
  {
    group: 'SQL',
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
    vendors: ['snowflake', 'bigquery'],
  },
  {
    group: 'Document',
    vendors: ['elasticsearch'],
  },
  {
    group: 'Time Series',
    vendors: ['clickhouse', 'prometheus', 'influx', 'crate', 'timescale', 'yugabyte'],
  },
];
