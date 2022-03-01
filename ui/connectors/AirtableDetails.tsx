import * as React from 'react';
import { DatabaseConnectorInfo, ServerInfo } from '../../shared/state';
import { FormGroup } from '../components/FormGroup';
import { ApiKey } from './ApiKey';

export function AirtableDetails(props: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
  servers: Array<ServerInfo>;
}) {
  return (
    <FormGroup>
      <ApiKey {...props} />
    </FormGroup>
  );
}
