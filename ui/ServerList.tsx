import * as React from 'react';
import { ProjectState, ServerInfo } from '../shared/state';
import { Button } from './components/Button';
import { Server } from './Server';

export function ServerList({
  state,
  updateServer,
  deleteServer,
}: {
  state: ProjectState;
  updateServer: (dc: ServerInfo, position: number, insert: boolean) => void;
  deleteServer: (id: string) => void;
}) {
  return (
    <div className="servers">
      <h2 className="title">SSH Connections</h2>
      <p className="subtitle text-muted">
        For connecting to remote servers, reading remote files.
      </p>
      {state.servers?.length === 0 ? (
        <p>You don't have any connections yet.</p>
      ) : null}
      {state.servers?.map((dc: ServerInfo, i: number) => (
        <Server
          key={dc.id}
          server={dc}
          updateServer={(dc: ServerInfo) => updateServer(dc, i, false)}
          deleteServer={() => deleteServer(dc.id)}
        />
      ))}
      <div className="text-center">
        <Button
          onClick={() => {
            updateServer(
              new ServerInfo({
                name: `Untitled Server #${state.servers?.length + 1}`,
              }),
              -1,
              true
            );
          }}
        >
          Add SSH Connection
        </Button>
      </div>
    </div>
  );
}
