import { IconTrash } from '@tabler/icons';
import * as React from 'react';
import { MODE } from '../shared/constants';
import { ServerInfo, ServerInfoType } from '../shared/state';
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
  const [expanded, setExpanded] = React.useState(!server.defaultModified);

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
    <div
      className={`server ${expanded ? 'server--expanded' : 'clickable'}`}
      onClick={
        expanded
          ? null
          : function toggleExpanded() {
              return setExpanded(true);
            }
      }
    >
      <div className="server-header vertical-align-center">
        {expanded ? (
          <Input
            className="server-name"
            onChange={function handleNameChange(value: string) {
              server.name = value;
              updateServer(server);
            }}
            value={server.name}
          />
        ) : (
          <span className="server-name">{server.name}</span>
        )}
        <div className="flex-right">
          <span title="Delete server">
            <Confirm
              className="server-delete"
              onConfirm={deleteServer}
              message="delete this server"
              action="Delete"
              render={function renderDelete(confirm: () => void) {
                return (
                  <Button
                    icon
                    onClick={function (e) {
                      e.stopPropagation();
                      confirm();
                    }}
                  >
                    <IconTrash />
                  </Button>
                );
              }}
            />
          </span>
        </div>
      </div>
      {expanded && (
        <div className="server-body">
          <div className="form-row">
            <Input
              label="Address"
              value={server.address}
              type="url"
              onChange={function handleAddressChange(value: string) {
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
              onChange={function handlePortChange(value: string) {
                server.port = +value;
                updateServer(server);
              }}
            />
          </div>
          <div className="form-row">
            <Select
              label="Method"
              value={server.type}
              onChange={function handleMethodChange(value: string) {
                server.type = value as ServerInfoType;
                updateServer(server);
              }}
            >
              {/*<option value="ssh-agent">SSH Agent</option>*/}
              <option value="private-key">Private Key</option>
              <option value="password">Password</option>
            </Select>
          </div>
          {['private-key', 'password'].includes(server.type) && (
            <div className="form-row">
              <Input
                label="Username"
                value={server.username}
                onChange={function handleUsernameChange(value: string) {
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
                  onChange={function handlePrivateKeyChange(fileName: string) {
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
                onBlur={function passwordOnBlur() {
                  syncPassword(
                    'password',
                    null
                  ); /* Turns off continued attempts to encrypt */
                }}
              />
            </div>
          ) : null}
          {expanded && (
            <div className="text-center">
              <Button
                type="outline"
                onClick={function closeServer() {
                  setExpanded(false);
                }}
              >
                Close
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
