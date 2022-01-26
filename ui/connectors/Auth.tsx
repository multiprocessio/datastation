import * as React from 'react';
import { DatabaseConnectorInfo, Encrypt, ServerInfo } from '../../shared/state';
import { FormGroup } from '../components/FormGroup';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { ServerPicker } from '../components/ServerPicker';
import { Host } from './Host';
import { Password } from './Password';
import { Username } from './Username';
import { ApiKey } from './ApiKey';

export function Auth(props: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
}) {
  const { connector, updateConnector, servers } = props;


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
        <FormGroup label="Authentication">
        <div className="form-row">
          <Select
            label="Authentication"
            onChange={setAuthMethod}
            value={authMethod}
          >
            <option value="apikey">Base64 Encoded API Key</option>
            <option value="basic">Basic Authentication</option>
          </Select>
        </div>
        {authMethod === 'apikey' && (
          <Auth {...props} />
        )}
        {authMethod === 'basic' && (
          <React.Fragment>
            <Username {...props} />
            <Password {...props} />
          </React.Fragment>
        )}
  </FormGroup>
);
}
