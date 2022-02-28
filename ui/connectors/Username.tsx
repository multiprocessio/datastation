import * as React from 'react';
import { DatabaseConnectorInfo } from '../../shared/state';
import { Input } from '../components/Input';

export function Username({
  connector,
  updateConnector,
  label,
}: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
  label?: string;
}) {
  return (
    <div className="form-row">
      <Input
        label={label || 'Username'}
        value={connector.database.username}
        onChange={(value: string) => {
          connector.database.username = value;
          updateConnector(connector);
        }}
      />
    </div>
  );
}
