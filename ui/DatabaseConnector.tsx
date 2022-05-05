import * as React from 'react';
import { DatabaseConnectorInfo } from '../shared/state';
import { VENDORS } from './connectors';
import { ProjectContext } from './state';

export function DatabaseConnector({
  connector,
  updateConnector,
}: {
  connector: DatabaseConnectorInfo;
  updateConnector: (dc: DatabaseConnectorInfo) => void;
}) {
  const { servers } = React.useContext(ProjectContext).state;
  const { details: Details } = VENDORS[connector.database.type];
  return (
    <Details
      connector={connector}
      updateConnector={updateConnector}
      servers={servers}
    />
  );
}
