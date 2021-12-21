import log from '../../shared/log';
import {
  DatabaseConnectorInfo,
  DatabasePanelInfo,
  PanelInfo,
  ProjectState,
} from '../../shared/state';
import { fullHttpURL } from '../../shared/url';
import { Dispatch } from '../rpc';
import { decryptFields } from '../secret';
import { evalElasticsearch } from './databases/elasticsearch';
import { evalInflux } from './databases/influx';
import { evalPrometheus } from './databases/prometheus';
import { evalSnowflake } from './databases/snowflake';
import { evalSplunk } from './databases/splunk';
import { tunnel } from './tunnel';
import { EvalHandlerExtra, EvalHandlerResponse, guardPanel } from './types';

export function getAndDecryptConnector(
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

  decryptFields(connector);

  return connector;
}

const DEFAULT_PORT = {
  postgres: 5432,
  sqlite: 0,
  cassandra: 9160,
  snowflake: 443,
  presto: 8080,
  elasticsearch: 9200,
  influx: 8086,
  splunk: 443,
  prometheus: 9090,
  mysql: 3306,
  sqlserver: 1433,
  oracle: 1521,
  clickhouse: 8123,
};

export function portHostFromAddress(
  info: DatabasePanelInfo,
  connector: DatabaseConnectorInfo
) {
  // TODO: this needs to be more robust. Not all systems format ports the same way
  const port =
    +connector.database.address.split(':')[1] ||
    DEFAULT_PORT[connector.database.type];
  let host = connector.database.address.split(':')[0];
  if (host.includes('?')) {
    host = host.split('?')[0];
  }
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

  const connector = getAndDecryptConnector(project, info.database.connectorId);
  const serverId = connector.serverId || info.serverId;

  if (
    connector.database.type === 'elasticsearch' ||
    connector.database.type === 'splunk' ||
    connector.database.type === 'prometheus' ||
    connector.database.type === 'influx'
  ) {
    const defaultPort = DEFAULT_PORT[connector.database.type];
    // This is going to get annoying if one of these dbs ever has a non-HTTP protocol.
    const { protocol, hostname, port } = new URL(
      fullHttpURL(connector.database.address, undefined, defaultPort)
    );
    log.info(
      `Connecting ${
        serverId ? 'through tunnel ' : ''
      }to ${protocol}//${hostname}:${port} for ${connector.database.type} query`
    );
    return await tunnel(
      project,
      serverId,
      hostname,
      +port,
      (host: string, port: number) => {
        host = host || 'localhost';
        if (connector.database.type === 'elasticsearch') {
          return evalElasticsearch(
            content,
            info.database.range,
            host,
            port,
            connector,
            info
          );
        }

        if (connector.database.type === 'splunk') {
          return evalSplunk(
            content,
            info.database.range,
            host,
            port,
            connector
          );
        }

        if (connector.database.type === 'prometheus') {
          return evalPrometheus(
            content,
            info.database.range,
            protocol + '//' + host,
            port,
            connector,
            info
          );
        }

        if (connector.database.type === 'influx') {
          return evalInflux(
            content,
            info.database.range,
            protocol + '//' + host,
            port,
            connector,
            info
          );
        }
      }
    );
  }

  if (connector.database.type === 'snowflake') {
    return await evalSnowflake(content, connector);
  }

  throw new Error(`Unknown SQL type: ${connector.database.type}`);
}
