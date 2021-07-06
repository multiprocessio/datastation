import * as React from 'react';

import { ServerInfo, ProjectState } from '../shared/state';
import { Server } from './Server';
import { Button } from './component-library/Button';

export function Servers({
  state,
  addServer,
  updateServer,
  deleteServer,
}: {
  state: ProjectState;
  addServer: (dc: ServerInfo) => void;
  updateServer: (n: number, dc: ServerInfo) => void;
  deleteServer: (n: number) => void;
}) {
  return (
    <div className="servers">
      <h2 className="title">Servers</h2>
      {state.servers?.map((dc: ServerInfo, i: number) => (
        <Server
          key={dc.id}
          server={dc}
          updateServer={(dc: ServerInfo) => updateServer(i, dc)}
          deleteServer={deleteServer.bind(null, i)}
        />
      ))}
      <div className="text-center">
        <Button
          type="primary"
          onClick={() => {
            addServer(new ServerInfo());
          }}
        >
          New Server
        </Button>
      </div>
    </div>
  );
}
