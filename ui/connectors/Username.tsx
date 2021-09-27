import * as React from 'react';
import { DatabaseConnectorInfo } from '../../shared/state';
import { Input } from '../components/Input';

export function Username({
  connector,
  updateConnector,
}: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
}) {
  return (
    <div className="form-row">
      <Input
        label="Username"
        value={connector.sql.username}
        onChange={(value: string) => {
          connector.sql.username = value;
          updateConnector(connector);
        }}
      />
    </div>
  );
}
