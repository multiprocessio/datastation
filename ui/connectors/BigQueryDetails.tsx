import * as React from 'react';
import { DatabaseConnectorInfo } from '../../shared/state';
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
    </React.Fragment>
  );
}
