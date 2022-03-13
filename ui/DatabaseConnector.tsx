import * as React from 'react';
import {
  DatabaseConnectorInfo,
  DatabaseConnectorInfoType,
} from '../shared/state';
import { FormGroup } from './components/FormGroup';
import { Select } from './components/Select';
import { VENDORS, VENDOR_GROUPS } from './connectors';
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
        <div className="form-row">
          <Select
            label="Vendor"
            value={connector.database.type}
            onChange={(value: string) => {
              connector.database.type = value as DatabaseConnectorInfoType;
              updateConnector(connector);
            }}
          >
            {VENDOR_GROUPS.map((group) => (
              <optgroup
                key={group.group}
                label={group.group}
                children={group.vendors.map((v) => (
                  <option key={v} value={v}>
                    {VENDORS[v].name}
                  </option>
                ))}
              />
            ))}
          </Select>
        </div>
      </FormGroup>
      <Details
        connector={connector}
        updateConnector={updateConnector}
        servers={servers}
      />
    </React.Fragment>
  );
}
