import * as React from 'react';
import { ServerInfo, SQLConnectorInfo } from '../../shared/state';
import { FileInput } from '../component-library/FileInput';
import { ServerPicker } from '../ServerPicker';

export function SQLiteDetails({
  connector,
  updateConnector,
  servers,
}: {
  connector: SQLConnectorInfo;
  updateConnector: (c: SQLConnectorInfo) => void;
  servers: Array<ServerInfo>;
}) {
  return (
    <React.Fragment>
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
