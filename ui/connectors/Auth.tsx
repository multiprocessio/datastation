import * as React from 'react';
import { DatabaseConnectorInfo } from '../../shared/state';
import { FormGroup } from '../components/FormGroup';
import { Select } from '../components/Select';
import { ApiKey } from './ApiKey';
import { Password } from './Password';
import { Username } from './Username';

export function Auth(props: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
  apiKeyLabel?: string;
}) {
  const { connector, apiKeyLabel } = props;

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
      {authMethod === 'apikey' && <ApiKey {...props} label={apiKeyLabel} />}
      {authMethod === 'basic' && (
        <React.Fragment>
          <Username {...props} />
          <Password {...props} />
        </React.Fragment>
      )}
    </FormGroup>
  );
}
