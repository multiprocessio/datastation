import * as React from 'react';
import { SQLConnectorInfo, SQLConnectorInfoType } from '../shared/state';
import { Select } from './components/Select';
import { VENDORS } from './connectors';
import { ProjectContext } from './ProjectStore';

export function SQLConnector({
  connector,
  updateConnector,
}: {
  connector: SQLConnectorInfo;
  updateConnector: (dc: SQLConnectorInfo) => void;
}) {
  const { servers } = React.useContext(ProjectContext);

  return (
    <React.Fragment>
      <div className="form-row">
        <Select
          label="Vendor"
          value={connector.sql.type}
          onChange={(value: string) => {
            connector.sql.type = value as SQLConnectorInfoType;
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
          v.id === connector.sql.type
            ? v.details({ connector, updateConnector, servers })
            : null
        )
      )}
    </React.Fragment>
  );
}
