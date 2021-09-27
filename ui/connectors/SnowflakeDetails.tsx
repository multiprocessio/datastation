import * as React from 'react';
import { SQLConnectorInfo } from '../../shared/state';
import { Input } from '../components/Input';
import { Database } from './Database';
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
        label="Account ID"
        value={connector.sql.extra.account}
        onChange={(value: string) => {
          connector.sql.extra.account = value;
          updateConnector(connector);
        }}
        placeholder="qqlavcs-aa92002"
      />
      <Database {...props} placeholder="SNOWFLAKE_SAMPLE_DATA" />
      <Username {...props} />
      <Password {...props} />
    </React.Fragment>
  );
}
