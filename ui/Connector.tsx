import * as React from 'react';

import { DataConnectorInfo, SQLDataConnectorInfo } from './ProjectStore';
import { SQLDataConnector } from './SQLDataConnector';
import { Input } from './component-library/Input';

export function DataConnector({
  dataConnector,
  updateDataConnector,
}: {
  dataConnector: DataConnectorInfo;
  updateDataConnector: (dc: DataConnectorInfo) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div
      className="dataConnector clickable"
      onClick={() => setExpanded(!expanded)}
    >
      <span className="dataConnector-type">{dataConnector.type}</span>
      <span className="dataConnector-name">
        {expanded ? (
          <Input
            className="dataConnector-name"
            onChange={(value: string) =>
              updateDataConnector({ ...dataConnector, name: value })
            }
            value={dataConnector.name}
          />
        ) : (
          dataConnector.name
        )}
      </span>
      {expanded && (
        <React.Fragment>
          {dataConnector.type === 'sql' && (
            <SQLDataConnector
              dataConnector={dataConnector as SQLDataConnectorInfo}
              updateDataConnector={updateDataConnector}
            />
          )}
        </React.Fragment>
      )}
    </div>
  );
}
