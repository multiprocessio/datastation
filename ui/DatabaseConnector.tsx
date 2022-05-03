import * as React from 'react';
import { DatabaseConnectorInfo } from '../shared/state';
import { FormGroup } from './components/FormGroup';
import { Input } from './components/Input';
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
    <React.Fragment>
      <FormGroup>
        <Input
          onChange={null}
          value={VENDORS[connector.database.type].name}
          disabled
        />
      </FormGroup>
      <Details
        connector={connector}
        updateConnector={updateConnector}
        servers={servers}
      />
    </React.Fragment>
  );
}
