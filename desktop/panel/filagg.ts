import { file as makeTmpFile } from 'tmp-promise';
import log from '../../shared/log';
import {
  FilterAggregatePanelInfo,
  PanelInfo,
  ProjectState,
  SQLConnectorInfo,
  SQLPanelInfo,
} from '../../shared/state';
import { evalSQL } from './sql';
import { EvalHandlerExtra, guardPanel } from './types';

export async function evalFilterAggregate(
  project: ProjectState,
  panel: PanelInfo,
  extra: EvalHandlerExtra,
) {
  const {
    panelSource,
    aggregateType,
    aggregateOn,
    groupBy,
    filter,
    sortOn,
    sortAsc,
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
    const metaPanel = new SQLPanelInfo('', 'sqlite', '', query);
    const metaConnector = new SQLConnectorInfo('', 'sqlite', tmp.path);
    // Register connector in project
    if (!project.connectors) {
      project.connectors = [];
    }
    project.connectors.push(metaConnector);
    return await evalSQL(project, metaPanel, extra);
  } finally {
    try {
      await tmp.cleanup();
    } catch (e) {
      log.error(e);
    }
  }
}
