import * as React from 'react';
import { DatabaseConnectorInfo, ServerInfo } from '../../shared/state';
import { FormGroup } from '../components/FormGroup';
import { Input } from '../components/Input';
import { Database } from './Database';
import { Password } from './Password';
import { Username } from './Username';

export function AthenaDetails(props: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
  servers: Array<ServerInfo>;
}) {
  const { connector, updateConnector } = props;

  return (
    <>
      <FormGroup>
        <Database {...props} />
        <div className="form-row">
          <Input
            label="Output Bucket"
            placeholder="s3://..."
            value={connector.database.address}
            onChange={(value: string) => {
              connector.database.address = value;
              updateConnector(connector);
            }}
            {...props}
          />
        </div>
        <div className="form-row">
          <Input
            label="Region"
            value={connector.database.extra.aws_region}
            onChange={(value: string) => {
              connector.database.extra.aws_region = value;
              updateConnector(connector);
            }}
            {...props}
          />
        </div>
        <div className="form-row">
          <Username label="Access Key ID" {...props} />
        </div>
        <Password label="Secret Access Key" {...props} />
      </FormGroup>
      <FormGroup optional="Optional Fields">
        <div className="form-row">
          <Input
            label="Temporary Security Token"
            value={connector.database.extra.aws_temp_security_token}
            onChange={(value: string) => {
              connector.database.extra.aws_temp_security_token = value;
              updateConnector(connector);
            }}
            {...props}
          />
        </div>
        <div className="form-row">
          <Input
            label="Workgroup"
            value={connector.database.extra.workgroup}
            onChange={(value: string) => {
              connector.database.extra.workgroup = value;
              updateConnector(connector);
            }}
            {...props}
          />
        </div>
      </FormGroup>
    </>
  );
}
