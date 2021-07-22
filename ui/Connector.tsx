import * as React from 'react';
import { ConnectorInfo, SQLConnectorInfo } from '../shared/state';
import { Button } from './component-library/Button';
import { Confirm } from './component-library/Confirm';
import { Input } from './component-library/Input';
import { SQLConnector } from './SQLConnector';

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
        <span title="Delete data source">
          <Confirm
            right
            onConfirm={deleteConnector}
            message="delete this data source"
            action="Delete"
            className="page-delete"
            render={(confirm: () => void) => (
              <Button icon onClick={confirm}>
                delete
              </Button>
            )}
          />
        </span>
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
