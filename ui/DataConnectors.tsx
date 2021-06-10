import * as React from 'react';

import {
  DataConnectorInfo,
  ProjectState,
  SQLDataConnectorInfo,
} from './ProjectStore';
import { DataConnector } from './DataConnector';
import { Button } from './component-library/Button';

export function DataConnectors({
  state,
  addDataConnector,
  updateDataConnector,
}: {
  state: ProjectState;
  addDataConnector: (dc: DataConnectorInfo) => void;
  updateDataConnector: (n: number, dc: DataConnectorInfo) => void;
}) {
  const [expanded, setExpanded] = React.useState(true);
  if (!expanded) {
    <div className="section dataConnectors dataConnectors--collapsed">
      <div className="title">
        <span className="material-icons-outlined">manage_search</span>
      </div>
      <Button icon onClick={() => setExpanded(true)}>
        keyboard_arrow_left
      </Button>
    </div>;
  }

  return (
    <div className="section dataConnectors">
      <div className="title">
        Data Connectors
        <span className="material-icons-outlined">manage_search</span>
      </div>
      <Button icon onClick={() => setExpanded(false)}>
        keyboard_arrow_right
      </Button>
      {state.dataConnectors?.map((dc: DataConnectorInfo, i: number) => (
        <DataConnector
          dataConnector={dc}
          updateDataConnector={(dc: DataConnectorInfo) =>
            updateDataConnector(i, dc)
          }
        />
      ))}
      <button
        type="button"
        className="button button--primary"
        onClick={() => {
          addDataConnector(new SQLDataConnectorInfo());
        }}
      >
        New Data Connector
      </button>
    </div>
  );
}
