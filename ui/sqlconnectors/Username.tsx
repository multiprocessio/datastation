import * as React from 'react';
import { SQLConnectorInfo } from '../../shared/state';
import { Input } from '../component-library/Input';

export function Username({
  connector,
  updateConnector,
}: {
  connector: SQLConnectorInfo;
  updateConnector: (c: SQLConnectorInfo) => void;
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
