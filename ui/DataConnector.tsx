import * as React from 'react';

import { DataConnectorInfo, SQLDataConnectorInfo } from './ProjectStore';
import { SQLDataConnector } from './SQLDataConnector';
import { Input } from './component-library/Input';

export function DataConnector({
  dataConnector,
  updateDataConnector,
}: {
  dataConnector: DataConnectorInfo;
  updateDataConnector: (dc: DataConnectorInfo) => void;
}) {
  return (
    <div className="dataConnector">
      <span className="dataConnector-type">{dataConnector.type}</span>
      <Input
        className="dataConnector-name"
        onChange={(value: string) => updateDataConnector({ ...dataConnector, name: value })}
        value={dataConnector.name}
      />
      {dataConnector.type === 'sql' && (
        <SQLDataConnector
          dataConnector={dataConnector as SQLDataConnectorInfo}
          updateDataConnector={updateDataConnector}
        />
      )}
    </div>
  );
}
