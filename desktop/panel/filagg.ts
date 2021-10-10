import { file as makeTmpFile } from 'tmp-promise';
import log from '../../shared/log';
import { buildSQLiteQuery } from '../../shared/sql';
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
  const vp = guardPanel<FilterAggregatePanelInfo>(panel, 'filagg');
  const query = buildSQLiteQuery(vp);

  const tmp = await makeTmpFile({ prefix: 'filagg-sqlite-' });
  log.info('Filagg loading into ' + tmp.path);
  try {
    const metaConnector = new DatabaseConnectorInfo({
      type: 'sqlite',
      database: tmp.path,
    });
    const metaPanel = new DatabasePanelInfo({
      content: query,
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
