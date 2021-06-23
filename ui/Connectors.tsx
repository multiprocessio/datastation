import * as React from 'react';

import { ConnectorInfo, ProjectState, SQLConnectorInfo } from '../shared/state';
import { Connector } from './Connector';
import { Button } from './component-library/Button';

export function Connectors({
  state,
  addConnector,
  updateConnector,
}: {
  state: ProjectState;
  addConnector: (dc: ConnectorInfo) => void;
  updateConnector: (n: number, dc: ConnectorInfo) => void;
}) {
  const [expanded, setExpanded] = React.useState(true);
  if (!expanded) {
    return (
      <div className="section connectors connectors--collapsed">
        <div className="title vertical-align-center">
          <span className="material-icons-outlined">manage_search</span>
          <Button icon onClick={() => setExpanded(true)}>
            keyboard_arrow_right
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="section connectors">
      <div className="title vertical-align-center">
        <span className="material-icons-outlined">manage_search</span>
        Connectors
        <Button icon className="flex-right" onClick={() => setExpanded(false)}>
          keyboard_arrow_left
        </Button>
      </div>
      {state.connectors?.map((dc: ConnectorInfo, i: number) => (
        <Connector
          connector={dc}
          updateConnector={(dc: ConnectorInfo) => updateConnector(i, dc)}
        />
      ))}
      <button
        type="button"
        className="button button--primary"
        onClick={() => {
          addConnector(new SQLConnectorInfo());
        }}
      >
        New Connector
      </button>
    </div>
  );
}
