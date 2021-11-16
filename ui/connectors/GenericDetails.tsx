import * as React from 'react';
import { DatabaseConnectorInfo, ServerInfo } from '../../shared/state';
import { ServerPicker } from '../components/ServerPicker';
import { Database } from './Database';
import { Host } from './Host';
import { Password } from './Password';
import { Username } from './Username';

export interface GenericDetailsProps {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
  servers: Array<ServerInfo>;
  skipDatabase?: boolean;
}

export function GenericDetails(props: GenericDetailsProps) {
  const { servers, connector, updateConnector } = props;
  const { skipDatabase, ...passalong } = props;

  return (
    <React.Fragment>
      <Host {...passalong} />
      {skipDatabase ? null : <Database {...passalong} connector={connector} />}
      <Username {...passalong} connector={connector} />
      <Password {...passalong} connector={connector} />
      <ServerPicker
        servers={servers}
        serverId={connector.serverId}
        onChange={(serverId: string) => {
          connector.serverId = serverId;
          updateConnector(connector);
        }}
      />
    </React.Fragment>
  );
}

export const GenericNoDatabaseDetails = (props: GenericDetailsProps) => (
  <GenericDetails {...props} skipDatabase />
);
