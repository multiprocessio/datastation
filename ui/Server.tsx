import * as React from 'react';
import { ServerInfo, ServerInfoType } from '../shared/state';
import { Button } from './component-library/Button';
import { Confirm } from './component-library/Confirm';
import { Input } from './component-library/Input';
import { Select } from './component-library/Select';

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
    server[which].value = p;
    server[which].encrypted = false;
    updateServer(server);
  }

  return (
    <div className="server">
      <div className="server-header vertical-align-center">
        <span title="Delete server">
          <Confirm
            right
            onConfirm={deleteServer}
            message="delete this server"
            action="Delete"
            className="page-delete"
            render={(confirm: () => void) => (
              <Button icon onClick={confirm}>
                delete
              </Button>
            )}
          />
        </span>
        <span>
          {expanded ? (
            <Input
              className="server-name"
              onChange={(value: string) => {
                server.name = name;
                updateServer(server);
              }}
              value={server.name}
            />
          ) : (
            server.name
          )}
        </span>
        <Button icon onClick={() => setExpanded(!expanded)}>
          {expanded ? 'unfold_less' : 'unfold_more'}
        </Button>
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
                <Input
                  label="Private Key"
                  value={server.privateKeyFile}
                  placeholder="~/.ssh/id_rsa"
                  onChange={(value: string) => {
                    server.privateKeyFile = value;
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
                  onBlur={
                    () =>
                      syncPassword(
                        'passphrase',
                        null
                      ) /* Turns off continued attempts to encrypt */
                  }
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
        </React.Fragment>
      )}
    </div>
  );
}
