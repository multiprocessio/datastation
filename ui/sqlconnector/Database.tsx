import * as React from 'react';
import { SQLConnectorInfo } from '../../shared/state';
import { Input } from '../component-library/Input';

export function Database({
  connector,
  updateConnector,
}: {
  connector: SQLConnectorInfo;
  updateConnector: (c: SQLConnectorInfo) => void;
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
      />
    </div>
  );
}
