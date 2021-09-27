import * as React from 'react';
import { DatabaseConnectorInfo } from '../../shared/state';
import { Input } from '../components/Input';

export function Database({
  connector,
  updateConnector,
  placeholder,
}: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
  placeholder?: string;
}) {
  return (
    <div className="form-row">
      <Input
        label="Database"
        value={connector.database.database}
        onChange={(value: string) => {
          connector.database.database = value;
          updateConnector(connector);
        }}
        placeholder={placeholder}
      />
    </div>
  );
}
