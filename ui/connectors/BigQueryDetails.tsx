import * as React from 'react';
import { DatabaseConnectorInfo } from '../../shared/state';
import { FormGroup } from '../components/FormGroup';
import { ApiKey } from './ApiKey';
import { Database } from './Database';

export function BigQueryDetails({
  connector,
  updateConnector,
}: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
}) {
  return (
    <React.Fragment>
      <FormGroup>
        <Database
          label="Project ID"
          connector={connector}
          updateConnector={updateConnector}
        />
        <ApiKey
          label="Service Account JSON"
          connector={connector}
          updateConnector={updateConnector}
        />
      </FormGroup>
    </React.Fragment>
  );
}
