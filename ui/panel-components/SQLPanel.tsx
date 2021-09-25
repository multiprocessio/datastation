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
import {
  guardPanel,
  PanelBodyProps,
  PanelDetailsProps,
  PanelUIDetails,
} from './types';

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

export function SQLPanelDetails({ panel, updatePanel }: PanelDetailsProps) {
  const sp = guardPanel<SQLPanelInfo>(panel, 'sql');
  const { connectors, servers } = React.useContext(ProjectContext);

  const vendorConnectors = connectors
    .map((c: ConnectorInfo) => {
      if (
        c.type !== 'sql' ||
        (c as SQLConnectorInfo).sql.type !== sp.sql.type
      ) {
        return null;
      }

      return c;
    })
    .filter(Boolean);

  React.useEffect(() => {
    if (!vendorConnectors.length && sp.sql.connectorId) {
      sp.sql.connectorId = '';
    }
  });

  return (
    <React.Fragment>
      <div className="form-row">
        <Select
          label="Vendor"
          value={sp.sql.type}
          onChange={(value: string) => {
            sp.sql.type = value as SQLConnectorInfoType;
            updatePanel(sp);
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
            value={sp.sql.connectorId}
            onChange={(connectorId: string) => {
              sp.sql.connectorId = connectorId;
              updatePanel(sp);
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
        serverId={sp.serverId}
        onChange={(serverId: string) => {
          sp.serverId = serverId;
          updatePanel(sp);
        }}
      />
    </React.Fragment>
  );
}

export function SQLPanelBody({
  updatePanel,
  panel,
  keyboardShortcuts,
}: PanelBodyProps) {
  const sp = guardPanel<SQLPanelInfo>(panel, 'sql');

  return (
    <CodeEditor
      id={sp.id}
      onKeyDown={keyboardShortcuts}
      value={sp.content}
      onChange={(value: string) => {
        sp.content = value;
        updatePanel(sp);
      }}
      language="sql"
      className="editor"
    />
  );
}

export const sqlPanel: PanelUIDetails = {
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
  killable: true,
};
