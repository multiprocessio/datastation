import * as React from 'react';
import { DatabaseConnectorInfo } from '../../shared/state';
import { ApiKey } from './ApiKey';

export function GoogleSheetsDetails({
  connector,
  updateConnector,
}: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
}) {
  return (
    <React.Fragment>
      <ApiKey
        label="Service Account JSON"
        connector={connector}
        updateConnector={updateConnector}
      />
    </React.Fragment>
  );
}
