import * as React from 'react';

import {
  DataConnectorInfo,
  ProjectState,
  SQLDataConnectorInfo,
} from './ProjectStore';
import { DataConnector } from './DataConnector';

export function DataConnectors({
  state,
  addDataConnector,
  updateDataConnector,
}: {
  state: ProjectState;
  addDataConnector: (dc: DataConnectorInfo) => void;
  updateDataConnector: (n: number, dc: DataConnectorInfo) => void;
}) {
  return (
    <div className="section dataConnectors">
      <div className="title">Data Connectors</div>
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
