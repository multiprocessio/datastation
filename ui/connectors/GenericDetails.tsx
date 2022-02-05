import * as React from 'react';
import { DatabaseConnectorInfo, ServerInfo } from '../../shared/state';
import { FormGroup } from '../components/FormGroup';
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
  const { servers, connector, updateConnector, skipDatabase } = props;

  return (
    <React.Fragment>
      <FormGroup>
        <Host connector={connector} updateConnector={updateConnector} />
        {skipDatabase ? null : (
          <Database connector={connector} updateConnector={updateConnector} />
        )}
        <Username connector={connector} updateConnector={updateConnector} />
        <Password connector={connector} updateConnector={updateConnector} />
      </FormGroup>
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
  <GenericDetails
    connector={props.connector}
    updateConnector={props.updateConnector}
    servers={props.servers}
    skipDatabase
  />
);
