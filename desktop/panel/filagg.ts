import { file as makeTmpFile } from 'tmp-promise';
import log from '../../shared/log';
import {
  DatabaseConnectorInfo,
  DatabasePanelInfo,
  FilterAggregatePanelInfo,
  PanelInfo,
  ProjectState,
} from '../../shared/state';
import { Dispatch } from '../rpc';
import { evalDatabase } from './database';
import { EvalHandlerExtra, guardPanel } from './types';

export async function evalFilterAggregate(
  project: ProjectState,
  panel: PanelInfo,
  extra: EvalHandlerExtra,
  dispatch: Dispatch
) {
  const {
    panelSource,
    aggregateType,
    aggregateOn,
    groupBy,
    filter,
    sortOn,
    sortAsc,
    range,
    limit,
  } = guardPanel<FilterAggregatePanelInfo>(panel, 'filagg').filagg;
  let columns = '*';
  let groupByClause = '';
  if (aggregateType !== 'none') {
    columns = `"${groupBy}", ${aggregateType.toUpperCase()}(${
      aggregateOn ? '"' + aggregateOn + '"' : 1
    }) AS "${aggregateType}"`;
    groupByClause = `GROUP BY ${groupBy}`;
  }
  const whereClause = filter ? 'WHERE ' + filter : '';
  let sort = sortOn;
  if ((sortOn || '').startsWith('Aggregate: ')) {
    sort = `${aggregateType.toUpperCase()}(${
      aggregateOn ? '`' + aggregateOn + '`' : 1
    })`;
  }
  const orderByClause = `ORDER BY ${sort} ${sortAsc ? 'ASC' : 'DESC'}`;
  const query = `SELECT ${columns} FROM DM_getPanel(${panelSource}) ${whereClause} ${groupByClause} ${orderByClause} LIMIT ${limit}`;

  const tmp = await makeTmpFile();
  log.info('Filagg loading into ' + tmp.path);
  try {
    const metaPanel = new DatabasePanelInfo('', 'sqlite', '', range, query);
    const metaConnector = new DatabaseConnectorInfo('', 'sqlite', tmp.path);
    metaPanel.database.connectorId = metaConnector.id;
    // Register connector in project
    if (!project.connectors) {
      project.connectors = [];
    }
    project.connectors.push(metaConnector);
    return await evalDatabase(project, metaPanel, extra, dispatch);
  } finally {
    try {
      await tmp.cleanup();
    } catch (e) {
      log.error(e);
    }
  }
}
