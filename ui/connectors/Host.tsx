import * as React from 'react';
import { SQLConnectorInfo } from '../../shared/state';
import { Input } from '../components/Input';

export function Host({
  connector,
  updateConnector,
}: {
  connector: SQLConnectorInfo;
  updateConnector: (c: SQLConnectorInfo) => void;
}) {
  return (
    <div className="form-row">
      <Input
        label="Host"
        value={connector.sql.address}
        onChange={(value: string) => {
          connector.sql.address = value;
          updateConnector(connector);
        }}
      />
    </div>
  );
}
