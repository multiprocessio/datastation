import * as React from 'react';
import { ConnectorInfo, ProjectState, SQLConnectorInfo } from '../shared/state';
import { Button } from './components/Button';
import { Connector } from './Connector';

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
      <h2 className="title">Data Sources</h2>
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
