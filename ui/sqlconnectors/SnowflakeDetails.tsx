import * as React from 'react';
import { SQLConnectorInfo } from '../../shared/state';
import { Input } from '../component-library/Input';
import { Host } from './Host';
import { Password } from './Password';
import { Username } from './Username';

export function SnowflakeDetails(props: {
  connector: SQLConnectorInfo;
  updateConnector: (c: SQLConnectorInfo) => void;
}) {
  const { connector, updateConnector } = props;
  return (
    <React.Fragment>
      <Input
        label="Account"
        value={connector.sql.extra.account}
        onChange={(value: string) => {
          connector.sql.extra.account = value;
          updateConnector(connector);
        }}
      />
      <Host {...props} />
      <Username {...props} />
      <Password {...props} />
    </React.Fragment>
  );
}
