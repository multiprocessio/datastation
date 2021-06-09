import * as React from 'react';

import { SQLDataConnectorInfo } from './ProjectStore';
import { Input } from './component-library/Input';

export function SQLDataConnector({
  dataConnector,
  updateDataConnector,
}: {
  dataConnector: SQLDataConnectorInfo;
  updateDataConnector: (dc: SQLDataConnectorInfo) => void;
}) {
  // Don't try to show initial password
  const [password, setPassword] = React.useState('');
  React.useEffect(() => {
    // Sync typed password to state
    updateDataConnector({ ...dataConnector, password });
  }, [password]);

  return (
    <React.Fragment>
      <Input
        className="block"
        label="Address"
        value={dataConnector.address}
        onChange={(value: string) =>
          updateDataConnector({ ...dataConnector, address: value })
        }
      />
      <Input
        className="block"
        label="Database"
        value={dataConnector.database}
        onChange={(value: string) =>
          updateDataConnector({ ...dataConnector, database: value })
        }
      />
      <Input
        className="block"
        label="Username"
        value={dataConnector.username}
        onChange={(value: string) =>
          updateDataConnector({ ...dataConnector, username: value })
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
