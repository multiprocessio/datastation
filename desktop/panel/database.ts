import { sqlRangeQuery } from '../../shared/sql';
import {
  DatabaseConnectorInfo,
  DatabasePanelInfo,
  doOnEncryptFields,
  Encrypt,
  PanelInfo,
  ProjectState,
} from '../../shared/state';
import { Dispatch } from '../rpc';
import { decrypt } from '../secret';
import { evalClickHouse } from './databases/clickhouse';
import { evalElasticSearch } from './databases/elasticsearch';
import { evalInflux } from './databases/influx';
import { evalMySQL } from './databases/mysql';
import { evalOracle } from './databases/oracle';
import { evalPostgres } from './databases/postgres';
import { evalPrometheus } from './databases/prometheus';
import { evalSnowflake } from './databases/snowflake';
import { evalSplunk } from './databases/splunk';
import { evalSQLite } from './databases/sqlite';
import { evalSQLServer } from './databases/sqlserver';
import { transformDM_getPanelCalls } from './databases/sqlutil';
import { tunnel } from './tunnel';
import { EvalHandlerExtra, EvalHandlerResponse, guardPanel } from './types';

export async function getAndDecryptConnector(
  project: ProjectState,
  connectorId: string
) {
  const connectors = (project.connectors || []).filter(
    (c) => c.id === connectorId
  );
  if (!connectors.length) {
    throw new Error(`No such connector: ${connectorId}.`);
  }
  const connector = connectors[0] as DatabaseConnectorInfo;

  await doOnEncryptFields(connector, async (f: Encrypt) => {
    if (!f.value) {
      f.value = undefined;
      return f;
    }

    f.value = await decrypt(f.value);
    return f;
  });

  return connector;
}

const DEFAULT_PORT = {
  postgres: 5432,
  mysql: 3306,
  sqlite: 0,
  sqlserver: 1433,
  oracle: 1521,
  clickhouse: 8123,
  cassandra: 9160,
  snowflake: 443,
  presto: 8080,
  elasticsearch: 9200,
  influx: 8086,
  splunk: 443,
  prometheus: 9090,
};

export function portHostFromAddress(
  info: DatabasePanelInfo,
  connector: DatabaseConnectorInfo
) {
  // TODO: this needs to be more robust. Not all systems format ports the same way
  const port =
    +connector.database.address.split(':')[1] ||
    DEFAULT_PORT[info.database.type];
  const host = connector.database.address.split(':')[0];
  return { port, host };
}

export async function evalDatabase(
  project: ProjectState,
  panel: PanelInfo,
  extra: EvalHandlerExtra,
  dispatch: Dispatch
): Promise<EvalHandlerResponse> {
  const { content } = panel;
  const info = guardPanel<DatabasePanelInfo>(panel, 'database');

  const connector = await getAndDecryptConnector(
    project,
    info.database.connectorId
  );

  const serverId = connector.serverId || info.serverId;

  if (
    info.database.type === 'elasticsearch' ||
    info.database.type === 'splunk' ||
    info.database.type === 'prometheus' ||
    info.database.type === 'influx'
  ) {
    const { host, port } = portHostFromAddress(info, connector);
    return await tunnel(
      project,
      serverId,
      host,
      port,
      (host: string, port: number): any => {
        if (info.database.type === 'elasticsearch') {
          return evalElasticSearch(
            content,
            info.database.range,
            host,
            port,
            connector,
            info
          );
        }

        if (info.database.type === 'splunk') {
          return evalSplunk(
            content,
            info.database.range,
            host,
            port,
            connector
          );
        }

        if (info.database.type === 'prometheus') {
          return evalPrometheus(
            content,
            info.database.range,
            host,
            port,
            connector,
            info
          );
        }

        if (info.database.type === 'influx') {
          return evalInflux(
            content,
            info.database.range,
            host,
            port,
            connector,
            info
          );
        }
      }
    );
  }

  const { query, panelsToImport } = transformDM_getPanelCalls(
    content,
    extra.indexShapeMap,
    extra.indexIdMap,
    ['mysql', 'postgres', 'sqlite'].includes(info.database.type)
  );

  const rangeQuery = sqlRangeQuery(
    query,
    info.database.range,
    info.database.type
  );

  // SQLite is file, not network based so handle separately.
  if (info.database.type === 'sqlite') {
    return await evalSQLite(
      dispatch,
      rangeQuery,
      info,
      connector,
      project,
      panelsToImport
    );
  }

  if (info.database.type === 'snowflake') {
    return await evalSnowflake(rangeQuery, connector);
  }

  const { host, port } = portHostFromAddress(info, connector);

  // The way hosts are formatted is unique so have sqlserver manage its own call to tunnel()
  if (info.database.type === 'sqlserver') {
    return await tunnel(
      project,
      serverId,
      host.split('\\')[0],
      port,
      (host: string, port: number): any =>
        evalSQLServer(rangeQuery, host, port, connector)
    );
  }

  return await tunnel(
    project,
    serverId,
    host,
    port,
    (host: string, port: number): any => {
      if (info.database.type === 'postgres') {
        return evalPostgres(
          dispatch,
          rangeQuery,
          host,
          port,
          connector,
          project.projectName,
          panelsToImport
        );
      }

      if (info.database.type === 'mysql') {
        return evalMySQL(
          dispatch,
          rangeQuery,
          host,
          port,
          connector,
          project.projectName,
          panelsToImport
        );
      }

      if (info.database.type === 'oracle') {
        return evalOracle(rangeQuery, host, port, connector);
      }

      if (info.database.type === 'clickhouse') {
        return evalClickHouse(rangeQuery, host, port, connector);
      }

      throw new Error(`Unknown SQL type: ${info.database.type}`);
    }
  );
}
