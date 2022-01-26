import * as React from 'react';
import { DatabaseConnectorInfo } from '../../shared/state';
import { Database } from './Database';

export function GenericDetails({
  props,
}: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
}) {
  // Don't try to show initial apiKey
  const [apiKey, setApiKey] = React.useState('');
  function syncApiKey(p: string) {
    setApiKey(p);
    // Sync typed apiKey to state on change
    connector.database.apiKey_encrypt = new Encrypt(p);
    updateConnector(connector);
  }

  return (
    <React.Fragment>
      <Database connector={connector} updateConnector={updateConnector} />
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
