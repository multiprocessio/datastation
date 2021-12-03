import * as React from 'react';
import { ProjectState, ServerInfo } from '../shared/state';
import { Button } from './components/Button';
import { Server } from './Server';

export function ServerList({
  state,
  addServer,
  updateServer,
  deleteServer,
}: {
  state: ProjectState;
  addServer: (dc: ServerInfo) => void;
  updateServer: (id: string, dc: ServerInfo) => void;
  deleteServer: (id: string) => void;
}) {
  return (
    <div className="servers">
      <h2 className="title">SSH Connections</h2>
      {state.servers?.map((dc: ServerInfo, i: number) => (
        <Server
          key={dc.id}
          server={dc}
          updateServer={(dc: ServerInfo) => updateServer(dc.id, dc)}
          deleteServer={() => deleteServer(dc.id)}
        />
      ))}
      <div className="text-center">
        <Button
          onClick={() => {
            addServer(new ServerInfo());
          }}
        >
          Add Server
        </Button>
      </div>
    </div>
  );
}
