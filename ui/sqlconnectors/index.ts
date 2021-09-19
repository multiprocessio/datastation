import { GenericDetails } from './GenericDetails';
import { SnowflakeDetails } from './SnowflakeDetails';

export const VENDORS = [
  {
    group: 'Traditional',
    vendors: [
      {
        name: 'PostgreSQL',
        id: 'postgresql',
        details: GenericDetails,
      },
      {
        name: 'MySQL',
        id: 'mysql',
        details: GenericDetails,
      },
      {
        name: 'SQL Server',
        id: 'sqlserver',
        details: GenericDetails,
      },
      {
        name: 'Oracle',
        id: 'oracle',
        details: GenericDetails,
      },
      {
        name: 'SQLite',
        id: 'sqlite',
        details: GenericDetails,
      },
    ],
  },
  {
    group: 'Analytics',
    vendors: [
      {
        name: 'Clickhouse',
        id: 'clickhouse',
        details: GenericDetails,
      },
      {
        name: 'Snowflake',
        id: 'snowflake',
        details: SnowflakeDetails,
      },
    ],
  },
];
