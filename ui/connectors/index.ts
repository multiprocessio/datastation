import { DatabaseConnectorInfoType } from '@datastation/shared/state';
import { ElasticsearchDetails } from './ElasticsearchDetails';
import { GenericDetails, GenericNoDatabaseDetails } from './GenericDetails';
import { SnowflakeDetails } from './SnowflakeDetails';

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
    details: GenericDetails,
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
    vendors: ['postgres', 'mysql', 'sqlserver', 'oracle', 'sqlite'],
  },
  {
    group: 'Analytics',
    vendors: ['clickhouse', 'snowflake'],
  },
  {
    group: 'Log',
    vendors: ['elasticsearch'],
  },
  {
    group: 'Metrics',
    vendors: ['prometheus', 'influx'],
  },
];
