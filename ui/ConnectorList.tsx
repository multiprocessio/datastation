import * as React from 'react';
import {
  ConnectorInfo,
  DatabaseConnectorInfo,
  DatabaseConnectorInfoType,
  ProjectState,
} from '../shared/state';
import { Button } from './components/Button';
import { Dropdown } from './components/Dropdown';
import { Connector } from './Connector';
import { VENDORS, VENDOR_GROUPS } from './connectors';

function NewConnector({
  onClick,
}: {
  onClick: (type: DatabaseConnectorInfoType) => void;
}) {
  const groups = VENDOR_GROUPS.map((g) => ({
    name: g.group,
    id: g.group,
    items: g.vendors.map((id) => ({
      render(close: () => void) {
        return (
          <Button
            onClick={() => {
              onClick(id);
              close();
            }}
          >
            {VENDORS[id].name}
          </Button>
        );
      },
      id,
    })),
  }));

  return (
    <Dropdown
      className="add-panel"
      trigger={(open) => (
        <Button
          onClick={(e) => {
            e.preventDefault();
            open();
          }}
        >
          Add Panel
        </Button>
      )}
      title="Add Panel"
      groups={groups}
    />
  );
}

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
      <div className="new-panel">
        <NewConnector
          onClick={(type: DatabaseConnectorInfoType) => {
            updateConnector(new DatabaseConnectorInfo({ type }), -1, true);
          }}
        />
      </div>
    </div>
  );
}
