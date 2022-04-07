import { Ace } from 'ace-builds';
import * as React from 'react';
import { DOCS_ROOT } from '../../shared/constants';
import { NoConnectorError } from '../../shared/errors';
import log from '../../shared/log';
import {
  ConnectorInfo,
  DatabaseConnectorInfo,
  DatabasePanelInfo,
  PanelInfo,
  TimeSeriesRange as TimeSeriesRangeT,
} from '../../shared/state';
import { panelRPC } from '../asyncRPC';
import { CodeEditor } from '../components/CodeEditor';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { ServerPicker } from '../components/ServerPicker';
import { TimeSeriesRange } from '../components/TimeSeriesRange';
import { VENDORS } from '../connectors';
import { ProjectContext } from '../state';
import {
  builtinCompletions,
  dotAccessPanelShapeCompletions,
  panelNameCompletions,
  stringPanelShapeCompletions,
} from './ProgramPanel';
import { PanelBodyProps, PanelDetailsProps, PanelUIDetails } from './types';

export async function evalDatabasePanel(
  panel: DatabasePanelInfo,
  _1: unknown,
  _2: unknown,
  connectors: Array<ConnectorInfo>
) {
  const connector = connectors.find(
    (c) => c.id === panel.database.connectorId
  ) as DatabaseConnectorInfo;
  if (!connector) {
    throw new NoConnectorError();
  }

  return await panelRPC('eval', panel.id);
}

export function DatabasePanelDetails({
  panel,
  updatePanel,
}: PanelDetailsProps<DatabasePanelInfo>) {
  const { connectors, servers } = React.useContext(ProjectContext).state;

  if (!connectors.length && panel.database.connectorId) {
    panel.database.connectorId = '';
  }

  const connector = connectors.find(
    (c) => c.id === panel.database.connectorId
  ) as DatabaseConnectorInfo;

  React.useEffect(() => {
    if (!connector) {
      return;
    }

    if (
      ['prometheus'].includes(connector.database.type) &&
      !panel.database.range.field
    ) {
      panel.database.range.field = 'time';
    }
  });

  const vendorsWithConnectors = Object.keys(VENDORS)
    .sort()
    .map((id) => {
      const vendor = VENDORS[id as keyof typeof VENDORS];
      return {
        label: vendor.name,
        options: (connectors || []).filter(
          (c) =>
            c.type === 'database' &&
            (c as DatabaseConnectorInfo).database.type === id
        ),
      };
    })
    .filter((g) => g.options.length);

  return (
    <React.Fragment>
      <div className="form-row">
        {connectors.length === 0 ? (
          <small>Create a data source on the left to get started.</small>
        ) : (
          <React.Fragment>
            <Select
              label="Data Source"
              value={panel.database.connectorId}
              onChange={(connectorId: string) => {
                panel.database.connectorId = connectorId;
                updatePanel(panel);
              }}
              subtext={VENDORS[connector?.database.type]?.name}
            >
              {vendorsWithConnectors.map((g) => (
                <optgroup label={g.label} key={g.label}>
                  {g.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </React.Fragment>
        )}
      </div>
      {connector && (
        <React.Fragment>
          {connector.database.type === 'airtable' && (
            <>
              <div className="form-row">
                <Input
                  label="Base ID"
                  placeholder=""
                  value={panel.database.extra.airtable_app}
                  onChange={(i: string) => {
                    if (i.startsWith('https://')) {
                      try {
                        // e.g. https://airtable.com/appX/tblY/viwZ?blocks=hide
                        const [app, table, view] = i
                          .slice('https://airtable.com/'.length)
                          .split('?')[0]
                          .split('/');
                        panel.database.extra.airtable_app = app;
                        panel.database.table = table;
                        panel.database.extra.airtable_view = view;
                        updatePanel(panel);
                        return;
                      } catch (e) {
                        log.error(e);
                      }
                    }
                    panel.database.extra.airtable_app = i;
                    updatePanel(panel);
                  }}
                />
              </div>
              <div className="form-row">
                <Input
                  label="Table ID"
                  placeholder=""
                  value={panel.database.table}
                  onChange={(i: string) => {
                    panel.database.table = i;
                    updatePanel(panel);
                  }}
                />
              </div>
              <div className="form-row">
                <Input
                  label="View ID"
                  placeholder=""
                  value={panel.database.extra.airtable_view}
                  onChange={(i: string) => {
                    panel.database.extra.airtable_view = i;
                    updatePanel(panel);
                  }}
                />
              </div>
            </>
          )}
          {connector.database.type === 'elasticsearch' && (
            <div className="form-row">
              <Input
                label="Indexes"
                placeholder="journalbeat-*,logstash-*"
                value={panel.database.table}
                onChange={(i: string) => {
                  panel.database.table = i;
                  updatePanel(panel);
                }}
              />
            </div>
          )}
          {['elasticsearch', 'prometheus'].includes(
            connector.database.type
          ) && (
            <TimeSeriesRange
              range={panel.database.range}
              hideField={['prometheus'].includes(connector.database.type)}
              updateRange={(r: TimeSeriesRangeT) => {
                panel.database.range = r;
                updatePanel(panel);
              }}
            />
          )}
          {connector.database.type === 'prometheus' && (
            <div className="form-row">
              <Input
                label="Step (seconds)"
                type="number"
                value={panel.database.step}
                onChange={(s: string) => {
                  panel.database.step = +s;
                  updatePanel(panel);
                }}
              />
            </div>
          )}
          {!connector.serverId && (
            <ServerPicker
              servers={servers}
              serverId={panel.serverId}
              onChange={(serverId: string) => {
                panel.serverId = serverId;
                updatePanel(panel);
              }}
            />
          )}
        </React.Fragment>
      )}
    </React.Fragment>
  );
}

export function DatabasePanelBody({
  updatePanel,
  panel,
  panels,
  keyboardShortcuts,
}: PanelBodyProps<DatabasePanelInfo>) {
  return (
    <CodeEditor
      autocomplete={makeAutocomplete(panels.filter((p) => p.id !== panel.id))}
      id={'editor-' + panel.id}
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

export function makeAutocomplete(panels: Array<PanelInfo>) {
  return (tokenIteratorFactory: () => Ace.TokenIterator, prefix: string) => {
    return [
      ...builtinCompletions(tokenIteratorFactory).filter(
        (c) => !c.value.startsWith('DM_setPanel')
      ),
      ...panelNameCompletions(tokenIteratorFactory, panels),
      ...dotAccessPanelShapeCompletions(tokenIteratorFactory, panels),
      ...stringPanelShapeCompletions(tokenIteratorFactory, panels),
    ]
      .flat()
      .filter((c) => c && c.value.startsWith(prefix));
  };
}

export function DatabaseInfo({ panel }: { panel: DatabasePanelInfo }) {
  const { connectors } = React.useContext(ProjectContext).state;
  const connector = connectors.find(
    (c) => c.id === panel.database.connectorId
  ) as DatabaseConnectorInfo;

  const vendor = VENDORS[connector?.database.type]?.id;
  if (!['postgres', 'mysql', 'sqlite'].includes(vendor)) {
    return null;
  }

  return (
    <React.Fragment>
      Use <code>DM_getPanel($panel_number_or_name)</code> to reference other
      panels. Once you have called this once for one panel, use{' '}
      <code>t_$panel_number_or_name</code> to refer to it again. Read more{' '}
      <a target="_blank" href={DOCS_ROOT + '/Panels/Code_Panels.html'}>
        here
      </a>
      .
    </React.Fragment>
  );
}

export const databasePanel: PanelUIDetails<DatabasePanelInfo> = {
  icon: 'table_rows',
  eval: evalDatabasePanel,
  id: 'database',
  label: 'Database',
  details: DatabasePanelDetails,
  body: DatabasePanelBody,
  previewable: true,
  factory: (pageId: string) => new DatabasePanelInfo(pageId),
  hasStdout: false,
  info: DatabaseInfo,
};
