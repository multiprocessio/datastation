import * as React from 'react';
import { DatabaseConnectorInfo } from '../../shared/state';
import { Input } from '../components/Input';

export function Host({
  connector,
  updateConnector,
}: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
}) {
  return (
    <div className="form-row">
      <Input
        label="Host"
        value={connector.database.address}
        onChange={(value: string) => {
          connector.database.address = value;
          updateConnector(connector);
        }}
      />
    </div>
  );
}
