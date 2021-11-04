import { MODE } from '@datastation/shared/constants';
import { ServerInfo, ServerInfoType } from '@datastation/shared/state';
import * as React from 'react';
import { Button } from './components/Button';
import { Confirm } from './components/Confirm';
import { FileInput } from './components/FileInput';
import { Input } from './components/Input';
import { Select } from './components/Select';

export function Server({
  server,
  updateServer,
  deleteServer,
}: {
  server: ServerInfo;
  updateServer: (dc: ServerInfo) => void;
  deleteServer: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  // Don't try to show initial password
  const [password, setPassword] = React.useState({
    passphrase: '',
    password: '',
  });
  function syncPassword(which: 'passphrase' | 'password', p: string) {
    setPassword({
      ...password,
      [which]: p,
    });

    // Sync typed password to state on change
    const fieldKey = (which + '_encrypt') as
      | 'passphrase_encrypt'
      | 'password_encrypt';
    server[fieldKey].value = p;
    server[fieldKey].encrypted = false;
    updateServer(server);
  }

  return (
    <div className="server">
      <div className="server-header vertical-align-center">
        {expanded ? (
          <Input
            className="server-name"
            onChange={(value: string) => {
              server.name = value;
              updateServer(server);
            }}
            value={server.name}
          />
        ) : (
          <span className="server-name">{server.name}</span>
        )}
        <div className="flex-right">
          {!expanded && (
            <Button
              type="outline"
              icon
              className="hover-button"
              onClick={() => setExpanded(true)}
              title="Edit"
            >
              edit_outline
            </Button>
          )}
          <span title="Delete server">
            <Confirm
              right
              onConfirm={deleteServer}
              message="delete this server"
              action="Delete"
              className="hover-button"
              render={(confirm: () => void) => (
                <Button icon onClick={confirm} type="outline">
                  delete
                </Button>
              )}
            />
          </span>
        </div>
      </div>
      {expanded && (
        <React.Fragment>
          <div className="form-row">
            <Input
              label="Address"
              value={server.address}
              type="url"
              onChange={(value: string) => {
                server.address = value;
                updateServer(server);
              }}
            />
          </div>
          <div className="form-row">
            <Input
              label="Port"
              value={String(server.port)}
              type="number"
              onChange={(value: string) => {
                server.port = +value;
                updateServer(server);
              }}
            />
          </div>
          <div className="form-row">
            <Select
              label="Method"
              value={server.type}
              onChange={(value: string) => {
                server.type = value as ServerInfoType;
                updateServer(server);
              }}
            >
              <option value="ssh-agent">SSH Agent</option>
              <option value="private-key">Private Key</option>
              <option value="password">Password</option>
            </Select>
          </div>
          {['private-key', 'password'].includes(server.type) && (
            <div className="form-row">
              <Input
                label="Username"
                value={server.username}
                onChange={(value: string) => {
                  server.username = value;
                  updateServer(server);
                }}
              />
            </div>
          )}
          {server.type === 'private-key' ? (
            <React.Fragment>
              <div className="form-row">
                <FileInput
                  label="Private Key"
                  value={server.privateKeyFile}
                  placeholder="~/.ssh/id_ed25519"
                  allowManualEntry
                  allowFilePicker={MODE === 'desktop'}
                  onChange={(fileName: string) => {
                    server.privateKeyFile = fileName;
                    updateServer(server);
                  }}
                />
              </div>
              <div className="form-row">
                <Input
                  label="Passphrase"
                  value={password.passphrase}
                  type="password"
                  onChange={syncPassword.bind(null, 'passphrase')}
                />
              </div>
            </React.Fragment>
          ) : server.type === 'password' ? (
            <div className="form-row">
              <Input
                label="Password"
                value={password.password}
                type="password"
                onChange={syncPassword.bind(null, 'password')}
                onBlur={
                  () =>
                    syncPassword(
                      'password',
                      null
                    ) /* Turns off continued attempts to encrypt */
                }
              />
            </div>
          ) : null}
          {expanded && (
            <div className="text-center">
              <Button type="outline" onClick={() => setExpanded(false)}>
                Close
              </Button>
            </div>
          )}
        </React.Fragment>
      )}
    </div>
  );
}
