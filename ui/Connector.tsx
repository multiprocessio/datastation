import { IconTrash } from '@tabler/icons';
import * as React from 'react';
import { ConnectorInfo, DatabaseConnectorInfo } from '../shared/state';
import { DatabaseConnector } from './DatabaseConnector';
import { Button } from './components/Button';
import { Confirm } from './components/Confirm';
import { Input } from './components/Input';

export function Connector({
  connector,
  updateConnector,
  deleteConnector,
}: {
  connector: ConnectorInfo;
  updateConnector: (dc: ConnectorInfo) => void;
  deleteConnector: () => void;
}) {
  const [expanded, setExpanded] = React.useState(!connector.defaultModified);

  return (
    <div
      className={`connector ${expanded ? 'connector--expanded' : 'clickable'}`}
      onClick={expanded ? null : () => setExpanded(true)}
    >
      <div className="connector-header vertical-align-center">
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
          <span className="connector-name">{connector.name}</span>
        )}
        <div className="flex-right">
          <span title="Delete data source">
            <Confirm
              className="connector-delete"
              onConfirm={deleteConnector}
              message="delete this data source"
              action="Delete"
              render={(confirm: () => void) => (
                <Button
                  icon
                  onClick={function (e) {
                    e.stopPropagation();
                    confirm();
                  }}
                >
                  <IconTrash />
                </Button>
              )}
            />
          </span>
        </div>
      </div>
      {expanded && (
        <div className="connector-body">
          {connector.type === 'database' && (
            <DatabaseConnector
              connector={connector as DatabaseConnectorInfo}
              updateConnector={updateConnector}
            />
          )}
          <div className="text-center">
            <Button
              type="outline"
              onClick={function () {
                setExpanded(false);
              }}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
