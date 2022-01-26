import * as React from 'react';
import { DatabaseConnectorInfo, Encrypt, ServerInfo } from '../../shared/state';
import { FormGroup } from '../components/FormGroup';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { ServerPicker } from '../components/ServerPicker';
import { Host } from './Host';
import { Password } from './Password';
import { Username } from './Username';

export function ApiKey({
  connector,
  updateConnector,
  label="Api Key",
}: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
  label?: string;
}) {

    // Don't try to show initial apiKey
  const [apiKey, setApiKey] = React.useState('');
  function syncApiKey(p: string) {
    setApiKey(p);
    // Sync typed apiKey to state on change
    connector.database.apiKey_encrypt = new Encrypt(p);
    updateConnector(connector);
  }


  return (
          <div className="form-row">
            <Input
    label={label}
              type="password"
              value={apiKey}
              onChange={(value: string) => syncApiKey(value)}
            />
          </div>
  );
}
