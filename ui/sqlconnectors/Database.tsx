import * as React from 'react';
import { SQLConnectorInfo } from '../../shared/state';
import { Input } from '../component-library/Input';

export function Database({
  connector,
  updateConnector,
  placeholder,
}: {
  connector: SQLConnectorInfo;
  updateConnector: (c: SQLConnectorInfo) => void;
  placeholder?: string;
}) {
  return (
    <div className="form-row">
      <Input
        label="Database"
        value={connector.sql.database}
        onChange={(value: string) => {
          connector.sql.database = value;
          updateConnector(connector);
        }}
        placeholder={placeholder}
      />
    </div>
  );
}
