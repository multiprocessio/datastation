import * as React from 'react';

import { SQLConnectorInfo } from './ProjectStore';
import { Input } from './component-library/Input';

export function SQLConnector({
  dataConnector,
  updateConnector,
}: {
  dataConnector: SQLConnectorInfo;
  updateConnector: (dc: SQLConnectorInfo) => void;
}) {
  // Don't try to show initial password
  const [password, setPassword] = React.useState('');
  React.useEffect(() => {
    // Sync typed password to state
    updateConnector({ ...dataConnector, password });
  }, [password]);

  return (
    <React.Fragment>
      <Input
        className="block"
        label="Address"
        value={dataConnector.address}
        onChange={(value: string) =>
          updateConnector({ ...dataConnector, address: value })
        }
      />
      <Input
        className="block"
        label="Database"
        value={dataConnector.database}
        onChange={(value: string) =>
          updateConnector({ ...dataConnector, database: value })
        }
      />
      <Input
        className="block"
        label="Username"
        value={dataConnector.username}
        onChange={(value: string) =>
          updateConnector({ ...dataConnector, username: value })
        }
      />
      <Input
        className="block"
        label="Password"
        type="password"
        value={password}
        onChange={(value: string) => setPassword(value)}
      />
    </React.Fragment>
  );
}
