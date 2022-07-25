import * as React from 'react';
import { DatabaseConnectorInfo, ServerInfo } from '../../shared/state';
import { FileInput } from '../components/FileInput';
import { FormGroup } from '../components/FormGroup';
import { Input } from '../components/Input';
import { ServerPicker } from '../components/ServerPicker';
import { Database } from './Database';
import { Host } from './Host';
import { Password } from './Password';
import { Username } from './Username';

export function ODBCDetails(props: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
  servers: Array<ServerInfo>;
}) {
  const { servers, connector, updateConnector } = props;

  return (
    <React.Fragment>
      <FormGroup>
        <Host connector={connector} updateConnector={updateConnector} />
        <Username {...props} />
        <Password {...props} />
        <Database
          label="Database"
          connector={connector}
          updateConnector={updateConnector}
        />
        <div className="form-row">
          <FileInput
            allowFilePicker
            label="Driver"
            value={connector.database.extra.driver || ''}
            onChange={(value: string) => {
              connector.database.extra.driver = value;
              updateConnector(connector);
            }}
          />
        </div>
        <div className="form-row">
          <Input
            label="Additional parameters"
            value={connector.database.extra.params || ''}
            onChange={(value: string) => {
              connector.database.extra.params = value;
              updateConnector(connector);
            }}
            placeholder="A=Yes;B=somethingelse"
          />
        </div>
      </FormGroup>
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
