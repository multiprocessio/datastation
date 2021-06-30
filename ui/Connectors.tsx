import * as React from 'react';

import { ConnectorInfo, ProjectState, SQLConnectorInfo } from '../shared/state';
import { Connector } from './Connector';
import { Button } from './component-library/Button';

export function Connectors({
  state,
  addConnector,
  updateConnector,
  deleteConnector,
}: {
  state: ProjectState;
  addConnector: (dc: ConnectorInfo) => void;
  updateConnector: (n: number, dc: ConnectorInfo) => void;
  deleteConnector: (n: number) => void;
}) {
  return (
    <div className="connectors">
      {state.connectors?.map((dc: ConnectorInfo, i: number) => (
        <Connector
          key={dc.id}
          connector={dc}
          updateConnector={(dc: ConnectorInfo) => updateConnector(i, dc)}
          deleteConnector={deleteConnector.bind(null, i)}
        />
      ))}
      <div className="text-center">
        <Button
          type="primary"
          onClick={() => {
            addConnector(new SQLConnectorInfo());
          }}
        >
          New Connector
        </Button>
      </div>
    </div>
  );
}
