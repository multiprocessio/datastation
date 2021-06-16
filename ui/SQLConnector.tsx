import * as React from 'react';

import { SQLConnectorInfo } from '../shared/state';
import { Input } from './component-library/Input';

export function SQLConnector({
  connector,
  updateConnector,
}: {
  connector: SQLConnectorInfo;
  updateConnector: (dc: SQLConnectorInfo) => void;
}) {
  // Don't try to show initial password
  const [password, setPassword] = React.useState('');
  React.useEffect(() => {
    // Sync typed password to state
    connector.sql.password = password;
    updateConnector(connector);
  }, [password]);

  return (
    <React.Fragment>
      <div className="form-row">
        <Input
          label="Address"
          value={connector.sql.address}
          onChange={(value: string) => {
            connector.sql.address = value;
            updateConnector(connector);
          }}
        />
      </div>
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
      <div className="form-row">
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(value: string) => setPassword(value)}
        />
      </div>
    </React.Fragment>
  );
}
