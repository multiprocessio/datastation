import {
  DatabaseConnectorInfo,
  Encrypt,
  ServerInfo,
} from '@datastation/shared/state';
import * as React from 'react';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { ServerPicker } from '../components/ServerPicker';
import { Host } from './Host';
import { Password } from './Password';
import { Username } from './Username';

export function ElasticsearchDetails(props: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
  servers: Array<ServerInfo>;
}) {
  const { connector, updateConnector, servers } = props;

  // Don't try to show initial apiKey
  const [apiKey, setApiKey] = React.useState('');
  function syncApiKey(p: string) {
    setApiKey(p);
    // Sync typed apiKey to state on change
    connector.database.apiKey_encrypt = new Encrypt(p);
    updateConnector(connector);
  }

  const [authMethod, setAuthMethod] = React.useState(
    connector.database.apiKey_encrypt.value ||
      connector.database.apiKey_encrypt.encrypted
      ? 'apikey'
      : connector.database.password_encrypt.value ||
        connector.database.password_encrypt.encrypted
      ? 'basic'
      : 'bearer'
  );

  return (
    <React.Fragment>
      <Host {...props} defaultValue="localhost:9200" />
      <Username {...props} />
      <div className="form-row">
        <Select
          label="Authentication"
          onChange={setAuthMethod}
          value={authMethod}
        >
          <option value="apikey">Base64 Encoded API Key</option>
          <option value="basic">Basic Authentication</option>
        </Select>
        {authMethod === 'apikey' && (
          <Input
            label="Base64 Encoded API Key"
            type="password"
            value={apiKey}
            onChange={(value: string) => syncApiKey(value)}
          />
        )}
        {authMethod === 'basic' && (
          <React.Fragment>
            <Username {...props} />
            <Password {...props} />
          </React.Fragment>
        )}
      </div>
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
