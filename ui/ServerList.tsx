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
  updateServer: (dc: ServerInfo, position: number) => void;
  deleteServer: (id: string) => void;
}) {
  return (
    <div className="servers">
      <h2 className="title">SSH Connections</h2>
      {state.servers?.map((dc: ServerInfo, i: number) => (
        <Server
          key={dc.id}
          server={dc}
          updateServer={(dc: ServerInfo) => updateServer(dc, i)}
          deleteServer={() => deleteServer(dc.id)}
        />
      ))}
      <div className="text-center">
        <Button
          onClick={() => {
            updateServer(new ServerInfo(), -1);
          }}
        >
          Add Server
        </Button>
      </div>
    </div>
  );
}
