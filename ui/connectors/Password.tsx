import * as React from 'react';
import { DatabaseConnectorInfo } from '../../shared/state';
import { Input } from '../components/Input';

export function Password({
  connector,
  updateConnector,
}: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
}) {
  // Don't try to show initial password
  const [password, setPassword] = React.useState('');
  function syncPassword(p: string) {
    setPassword(p);
    // Sync typed password to state on change
    connector.database.password.value = p;
    connector.database.password.encrypted = false;
    updateConnector(connector);
  }

  return (
    <div className="form-row">
      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(value: string) => syncPassword(value)}
      />
    </div>
  );
}
