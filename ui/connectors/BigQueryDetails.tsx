import * as React from 'react';
import { DatabaseConnectorInfo, Encrypt } from '../../shared/state';
import { Input } from '../components/Input';
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
      <div className="form-row">
        <Input
          label="Service Account JSON"
          type="password"
          value={apiKey}
          onChange={(value: string) => syncApiKey(value)}
        />
      </div>
    </React.Fragment>
  );
}
