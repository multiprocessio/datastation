import * as React from 'react';
import { NoConnectorError } from '../../shared/errors';
import { SQLEvalBody } from '../../shared/rpc';
import {
  ConnectorInfo,
  PanelResult,
  ServerInfo,
  SQLConnectorInfo,
  SQLConnectorInfoType,
  SQLPanelInfo,
} from '../../shared/state';
import { asyncRPC } from '../asyncRPC';
import { CodeEditor } from '../component-library/CodeEditor';
import { Select } from '../component-library/Select';
import { ServerPicker } from '../component-library/ServerPicker';
import { ProjectContext } from '../ProjectStore';
import { VENDORS } from '../sqlconnectors';
import { PanelBodyProps, PanelDetailsProps, PanelUIDetails } from './types';

export async function evalSQLPanel(
  panel: SQLPanelInfo,
  panelResults: Array<PanelResult>,
  indexIdMap: Array<string>,
  connectors: Array<ConnectorInfo>,
  _1: Array<ServerInfo>
) {
  const indexShapeMap = panelResults.map((r) => r.shape);

  const connector = connectors.find(
    (c) => c.id === panel.sql.connectorId
  ) as SQLConnectorInfo;
  if (!connector) {
    throw new NoConnectorError();
  }

  return await asyncRPC<SQLEvalBody, string, PanelResult>(
    'evalSQL',
    panel.content,
    {
      ...panel,
      serverId: panel.serverId || connector.serverId,
      indexShapeMap,
      indexIdMap,
    }
  );
}

export function SQLPanelDetails({
  panel,
  updatePanel,
}: PanelDetailsProps<SQLPanelInfo>) {
  const { connectors, servers } = React.useContext(ProjectContext);

  const vendorConnectors = connectors
    .map((c: ConnectorInfo) => {
      if (
        c.type !== 'sql' ||
        (c as SQLConnectorInfo).sql.type !== panel.sql.type
      ) {
        return null;
      }

      return c;
    })
    .filter(Boolean);

  React.useEffect(() => {
    if (!vendorConnectors.length && panel.sql.connectorId) {
      panel.sql.connectorId = '';
    }
  });

  return (
    <React.Fragment>
      <div className="form-row">
        <Select
          label="Vendor"
          value={panel.sql.type}
          onChange={(value: string) => {
            panel.sql.type = value as SQLConnectorInfoType;
            updatePanel(panel);
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
      <div className="form-row">
        {vendorConnectors.length === 0 ? (
          'No connectors have been created for this vendor yet.'
        ) : (
          <Select
            label="Connector"
            value={panel.sql.connectorId}
            onChange={(connectorId: string) => {
              panel.sql.connectorId = connectorId;
              updatePanel(panel);
            }}
          >
            {vendorConnectors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </div>
      <ServerPicker
        servers={servers}
        serverId={panel.serverId}
        onChange={(serverId: string) => {
          panel.serverId = serverId;
          updatePanel(panel);
        }}
      />
    </React.Fragment>
  );
}

export function SQLPanelBody({
  updatePanel,
  panel,
  keyboardShortcuts,
}: PanelBodyProps<SQLPanelInfo>) {
  return (
    <CodeEditor
      id={panel.id}
      onKeyDown={keyboardShortcuts}
      value={panel.content}
      onChange={(value: string) => {
        panel.content = value;
        updatePanel(panel);
      }}
      language="sql"
      className="editor"
    />
  );
}

export const sqlPanel: PanelUIDetails<SQLPanelInfo> = {
  icon: 'table_rows',
  eval: evalSQLPanel,
  id: 'sql',
  label: 'SQL',
  details: SQLPanelDetails,
  body: SQLPanelBody,
  alwaysOpen: false,
  previewable: true,
  factory: () => new SQLPanelInfo(),
  hasStdout: false,
  info: null,
  killable: false,
};
