import * as React from 'react';

import { ConnectorInfo, SQLConnectorInfo } from './ProjectStore';
import { SQLConnector } from './SQLConnector';
import { Input } from './component-library/Input';

export function Connector({
  dataConnector,
  updateConnector,
}: {
  dataConnector: ConnectorInfo;
  updateConnector: (dc: ConnectorInfo) => void;
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
              updateConnector({ ...dataConnector, name: value })
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
            <SQLConnector
              dataConnector={dataConnector as SQLConnectorInfo}
              updateConnector={updateConnector}
            />
          )}
        </React.Fragment>
      )}
    </div>
  );
}
