import * as React from 'react';
import {
  ConnectorInfo,
  DatabaseConnectorInfo,
  ProjectState,
} from '../shared/state';
import { Button } from './components/Button';
import { Connector } from './Connector';
import { VENDORS } from './connectors';

export function ConnectorList({
  state,
  updateConnector,
  deleteConnector,
}: {
  state: ProjectState;
  updateConnector: (
    dc: ConnectorInfo,
    position: number,
    insert: boolean
  ) => void;
  deleteConnector: (id: string) => void;
}) {
  const groupedConnectors = Object.keys(VENDORS)
    .sort()
    .map((id) => ({
      name: VENDORS[id as keyof typeof VENDORS].name,
      connectors: (state.connectors || []).filter(
        (dc: ConnectorInfo) =>
          dc.type === 'database' &&
          (dc as DatabaseConnectorInfo).database.type === id
      ),
    }))
    .filter((v) => v.connectors.length);

  return (
    <div className="connectors">
      <h2 className="title">Data Sources</h2>
      {groupedConnectors.map((v) => (
        <React.Fragment key={v.name}>
          <small className="connector-group text-muted">{v.name}</small>
          {v.connectors.map((dc: ConnectorInfo, i) => (
            <Connector
              key={dc.id}
              connector={dc}
              updateConnector={(dc: ConnectorInfo) =>
                updateConnector(dc, i, false)
              }
              deleteConnector={() => deleteConnector(dc.id)}
            />
          ))}
        </React.Fragment>
      ))}
      <div className="text-center">
        <Button
          onClick={() => {
            updateConnector(new DatabaseConnectorInfo(), -1, true);
          }}
        >
          Add Data Source
        </Button>
      </div>
    </div>
  );
}
