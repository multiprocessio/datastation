import * as React from 'react';
import { DatabaseConnectorInfo, ServerInfo } from '../../shared/state';
import { FormGroup } from '../components/FormGroup';
import { Input } from '../components/Input';
import { Password } from './Password';

export function AthenaDetails(props: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
  servers: Array<ServerInfo>;
}) {
  const { connector, updateConnector } = props;

  return (
    <FormGroup>
      <div className="form-row">
        <Input
          label="AWS Access Key ID"
          value={connector.database.username}
          onChange={(value: string) => {
            connector.database.username = value;
            updateConnector(connector);
          }}
          {...props}
        />
      </div>
      <div className="form-row">
        <Password label="AWS Secret Access Key" {...props} />
      </div>
    </FormGroup>
  );
}
