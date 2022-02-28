import * as React from 'react';
import { DatabaseConnectorInfo, ServerInfo } from '../../shared/state';
import { FormGroup } from '../components/FormGroup';
import { ApiKey } from './ApiKey';
import { Username } from './Username';

export function AirtableDetails(props: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
  servers: Array<ServerInfo>;
}) {
  return (
    <FormGroup>
      <div className="form-row">
        <Username label="Base ID" {...props} />
      </div>
      <div className="form-row">
        <ApiKey {...props} />
      </div>
    </FormGroup>
  );
}
