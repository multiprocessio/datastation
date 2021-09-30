import { file as makeTmpFile } from 'tmp-promise';
import log from '../../shared/log';
import { ANSI_SQL_QUOTE, quote } from '../../shared/sql';
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
    columns = `${quote(
      groupBy,
      ANSI_SQL_QUOTE.identifier
    )}, ${aggregateType.toUpperCase()}(${
      aggregateOn ? quote(aggregateOn, ANSI_SQL_QUOTE.identifier) : 1
    }) AS ${quote(aggregateType, ANSI_SQL_QUOTE.identifier)}`;
    groupByClause = `GROUP BY ${quote(groupBy, ANSI_SQL_QUOTE.identifier)}`;
  }
  const whereClause = filter ? 'WHERE ' + filter : '';
  let sort = quote(sortOn, ANSI_SQL_QUOTE.identifier);
  if ((sortOn || '').startsWith('Aggregate: ')) {
    sort = `${aggregateType.toUpperCase()}(${
      aggregateOn ? quote(aggregateOn, ANSI_SQL_QUOTE.identifier) : 1
    })`;
  }
  const orderByClause = `ORDER BY ${sort} ${sortAsc ? 'ASC' : 'DESC'}`;
  const query = `SELECT ${columns} FROM DM_getPanel(${panelSource}) ${whereClause} ${groupByClause} ${orderByClause} LIMIT ${limit}`;

  const tmp = await makeTmpFile();
  log.info('Filagg loading into ' + tmp.path);
  try {
    const metaConnector = new DatabaseConnectorInfo({
      type: 'sqlite',
      database: tmp.path,
    });
    const metaPanel = new DatabasePanelInfo({
      content: query,
      range,
      connectorId: metaConnector.id,
    });

    // Register connector in project
    if (!project.connectors) {
      project.connectors = [];
    }
    project.connectors.push(metaConnector);
    log.info('Visual transform query: ' + query);
    return await evalDatabase(project, metaPanel, extra, dispatch);
  } finally {
    try {
      await tmp.cleanup();
    } catch (e) {
      log.error(e);
    }
  }
}
