import { DatabaseConnectorInfo } from '@datastation/shared/state';
import * as React from 'react';
import { Input, InputProps } from '../components/Input';

export function Host({
  connector,
  updateConnector,
  ...props
}: Partial<InputProps> & {
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
        {...props}
      />
    </div>
  );
}
