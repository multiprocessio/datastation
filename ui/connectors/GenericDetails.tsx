import { DatabaseConnectorInfo, ServerInfo } from '@datastation/shared/state';
import * as React from 'react';
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
      {skipDatabase ? null : <Database {...passalong} />}
      <Username {...passalong} />
      <Password {...passalong} />
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
