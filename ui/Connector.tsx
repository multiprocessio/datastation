import * as React from 'react';
import { ConnectorInfo, DatabaseConnectorInfo } from '../shared/state';
import { Button } from './components/Button';
import { Confirm } from './components/Confirm';
import { Input } from './components/Input';
import { DatabaseConnector } from './SQLConnector';

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
              <Button icon onClick={confirm} type="outline">
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
              onChange={(value: string) => {
                connector.name = value;
                updateConnector(connector);
              }}
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
            <DatabaseConnector
              connector={connector as DatabaseConnectorInfo}
              updateConnector={updateConnector}
            />
          )}
        </React.Fragment>
      )}
    </div>
  );
}
