import * as React from 'react';

import { ConnectorInfo, SQLConnectorInfo } from '../shared/state';
import { SQLConnector } from './SQLConnector';
import { Button } from './component-library/Button';
import { Input } from './component-library/Input';

export function Connector({
  connector,
  updateConnector,
  deleteConnector,
}: {
  connector: ConnectorInfo;
  updateConnector: (dc: ConnectorInfo) => void;
  deleteConnector: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="connector">
      <div className="connector-header vertical-align-center">
        <Button icon className="page-delete" onClick={deleteConnector}>
          delete
        </Button>
        <span className="connector-type">{connector.type}</span>
        <span className="connector-name">
          {expanded ? (
            <Input
              className="connector-name"
              onChange={(value: string) =>
                updateConnector({ ...connector, name: value })
              }
              value={connector.name}
            />
          ) : (
            connector.name
          )}
        </span>
        <Button icon onClick={() => setExpanded(!expanded)}>
          {expanded ? 'unfold_less' : 'unfold_more'}
        </Button>
      </div>
      {expanded && (
        <React.Fragment>
          {connector.type === 'sql' && (
            <SQLConnector
              connector={connector as SQLConnectorInfo}
              updateConnector={updateConnector}
            />
          )}
        </React.Fragment>
      )}
    </div>
  );
}
