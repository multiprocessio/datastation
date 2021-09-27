import * as React from 'react';
import { DatabaseConnectorInfo } from '../shared/state';
import { Select } from './components/Select';
import { VENDORS } from './connectors';
import { ProjectContext } from './ProjectStore';

export function DatabaseConnector({
  connector,
  updateConnector,
}: {
  connector: DatabaseConnectorInfo;
  updateConnector: (dc: DatabaseConnectorInfo) => void;
}) {
  const { servers } = React.useContext(ProjectContext);

  return (
    <React.Fragment>
      <div className="form-row">
        <Select
          label="Vendor"
          value={connector.database.type}
          onChange={(value: string) => {
            connector.database.type = value as DatabaseConnectorInfoType;
            updateConnector(connector);
          }}
        >
          {VENDORS.map((group) => (
            <optgroup
              label={group.group}
              children={group.vendors.map((v) => (
                <option value={v.id}>{v.name}</option>
              ))}
            />
          ))}
        </Select>
      </div>
      {VENDORS.map((g) =>
        g.vendors.map((v) =>
          v.id === connector.database.type
            ? v.details({ connector, updateConnector, servers })
            : null
        )
      )}
    </React.Fragment>
  );
}
