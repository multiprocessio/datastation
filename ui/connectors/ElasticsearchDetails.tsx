import * as React from 'react';
import { DatabaseConnectorInfo, ServerInfo } from '../../shared/state';
import { FormGroup } from '../components/FormGroup';
import { ServerPicker } from '../components/ServerPicker';
import { Auth } from './Auth';
import { Host } from './Host';

export function ElasticsearchDetails(props: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
  servers: Array<ServerInfo>;
}) {
  const { connector, updateConnector, servers } = props;

  return (
    <React.Fragment>
      <FormGroup>
        <Host {...props} />
      </FormGroup>
      <Auth {...props} apiKeyLabel="Base64 Encoded API Key" />
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
