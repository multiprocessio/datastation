import * as React from 'react';
import { ServerInfo } from '../shared/state';
import { Checkbox } from './component-library/Checkbox';
import { Select } from './component-library/Select';

export function ServerPicker({
  serverId,
  servers,
  onChange,
}: {
  serverId?: string;
  servers: Array<ServerInfo>;
  onChange: (v: string) => void;
}) {
  const [remote, setRemote] = React.useState(Boolean(serverId));

  if (!servers.length) {
    return null;
  }

  return (
    <React.Fragment>
      <div className="form-row">
        <Checkbox
          label="Via Server"
          value={remote}
          onChange={() => {
            onChange(null);
            setRemote(!remote);
          }}
        />
      </div>
      {remote && (
        <div className="form-row">
          <Select value={serverId} onChange={onChange}>
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      )}
    </React.Fragment>
  );
}
