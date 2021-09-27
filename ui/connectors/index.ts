import { DatabaseConnectorInfoType } from '../../shared/state';
import { ClickhouseDetails } from './ClickhouseDetails';
import { GenericDetails } from './GenericDetails';
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
    details: ClickhouseDetails,
  },
  snowflake: {
    name: 'Snowflake',
    id: 'snowflake',
    details: SnowflakeDetails,
  },
  elasticsearch: {
    name: 'ElasticSearch',
    id: 'elasticsearch',
    details: GenericDetails,
  },
  splunk: {
    name: 'Splunk',
    id: 'spunk',
    details: GenericDetails,
  },
  prometheus: {
    name: 'Prometheus',
    id: 'prometheus',
    details: GenericDetails,
  },
  influx: {
    name: 'Influx',
    id: 'influx',
    details: GenericDetails,
  },
};

export const VENDOR_GROUPS: Array<{
  group: string;
  vendors: Array<string>;
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
    vendors: ['elasticsearch', 'splunk'],
  },
  {
    group: 'Metrics',
    vendors: ['prometheus', 'influx'],
  },
];
