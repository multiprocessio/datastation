import * as React from 'react';
import { ServerInfo } from '../shared/state';
import { FormGroup } from './component-library/FormGroup';
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
  if (!servers.length) {
    return null;
  }

  return (
    <FormGroup label="Via server">
      <div className="form-row">
        <Select
          value={serverId}
          onChange={(v) => onChange(v === 'null' ? null : v)}
        >
          <option value="null">No</option>
          {servers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
    </FormGroup>
  );
}
