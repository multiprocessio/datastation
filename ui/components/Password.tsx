import * as React from 'react';
import { Encrypt } from '../../shared/state';
import { Input } from '../components/Input';

export function Password({ onChange }: { onChange: (e: Encrypt) => void }) {
  // Don't try to show initial password
  const [password, setPassword] = React.useState('');
  function syncPassword(p: string) {
    setPassword(p);
    // Sync typed password to state on change
    onChange(new Encrypt(p));
  }

  return (
    <div className="form-row">
      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(value: string) => syncPassword(value)}
      />
    </div>
  );
}
