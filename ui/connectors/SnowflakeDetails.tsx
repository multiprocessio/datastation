import * as React from 'react';
import { DatabaseConnectorInfo } from '../../shared/state';
import { Input } from '../components/Input';
import { FormGroup } from '../components/FormGroup';
import { Database } from './Database';
import { Password } from './Password';
import { Username } from './Username';

export function SnowflakeDetails(props: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
}) {
  const { connector, updateConnector } = props;
  return (
    <React.Fragment>
      <FormGroup>
        <div className="form-row">
          <Input
            label="Account ID"
            value={connector.database.extra.account}
            onChange={(value: string) => {
              connector.database.extra.account = value;
              updateConnector(connector);
            }}
            placeholder="qqlavcs-aa92002"
          />
        </div>
        <Database {...props} placeholder="SNOWFLAKE_SAMPLE_DATA" />
        <Username {...props} />
        <Password {...props} />
      </FormGroup>
      <FormGroup optional="Optional Fields">
        <div className="form-row">
          <Input
            label="Role"
            value={connector.database.extra.snowflake_role}
            onChange={(value: string) => {
              connector.database.extra.snowflake_role = value;
              updateConnector(connector);
            }}
            placeholder=""
          />
        </div>
        <div className="form-row">
          <Input
            label="Schema"
            value={connector.database.extra.snowflake_schema}
            onChange={(value: string) => {
              connector.database.extra.snowflake_schema = value;
              updateConnector(connector);
            }}
            placeholder=""
          />
        </div>
      </FormGroup>
    </React.Fragment>
  );
}
