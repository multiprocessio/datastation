import * as React from 'react';
import { SQLConnectorInfo, SQLConnectorInfoType } from '../shared/state';
import { FileInput } from './component-library/FileInput';
import { Input } from './component-library/Input';
import { Select } from './component-library/Select';
import { ProjectContext } from './ProjectStore';
import { ServerPicker } from './ServerPicker';

export function SQLConnector({
  connector,
  updateConnector,
}: {
  connector: SQLConnectorInfo;
  updateConnector: (dc: SQLConnectorInfo) => void;
}) {
  // Don't try to show initial password
  const [password, setPassword] = React.useState('');
  function syncPassword(p: string) {
    setPassword(p);

    // Sync typed password to state on change
    connector.sql.password = p;
    updateConnector(connector);
  }

  const { servers } = React.useContext(ProjectContext);

  return (
    <React.Fragment>
      <div className="form-row">
        <Select
          label="Vendor"
          value={connector.sql.type}
          onChange={(value: string) => {
            connector.sql.type = value as SQLConnectorInfoType;
            updateConnector(connector);
          }}
        >
          <option value="postgres">PostgreSQL</option>
          <option value="mysql">MySQL</option>
          <option value="sqlserver">SQL Server</option>
          {/* <option value="oracle">Oracle</option> */}
          <option value="sqlite">SQLite</option>
        </Select>
      </div>
      {connector.sql.type === 'sqlite' ? (
        <FileInput
          label="File"
          value={connector.sql.database}
          allowManualEntry
          allowFilePicker={!connector.serverId ? true : false}
          onChange={(fileName: string) => {
            connector.sql.database = fileName;
            updateConnector(connector);
          }}
        />
      ) : (
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
              onChange={(value: string) => syncPassword(value)}
            />
          </div>
        </React.Fragment>
      )}
      <ServerPicker
        servers={servers}
        serverId={connector.serverId}
        onChange={(serverId: string) => {
          connector.serverId = serverId;
          updateConnector(connector);
        }}
      />
    </React.Fragment>
  );
}
