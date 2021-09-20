import { file as makeTmpFile } from 'tmp-promise';
import { RPC } from '../../shared/constants';
import { FilterAggregateEvalBody } from '../../shared/rpc';
import { SQLConnectorInfo, SQLPanelInfo } from '../../shared/state';
import { Dispatch } from '../rpc';
import { rpcEvalHandler } from './eval';
import { evalSQLHandlerInternal } from './sql';

export const evalFilterAggregateHandler =
  rpcEvalHandler<FilterAggregateEvalBody>({
    resource: RPC.EVAL_FILTER_AGGREGATE,
    handler: async function (
      projectId: string,
      _: string,
      { indexIdMap, indexShapeMap, ...panel }: FilterAggregateEvalBody,
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
      } = panel.filagg;
      let columns = '*';
      let groupByClause = '';
      if (aggregateType !== 'none') {
        columns = `"${groupBy}", ${aggregateType.toUpperCase()}(${
          aggregateOn ? '"' + aggregateOn + '"' : 1
        }) AS "${aggregateType}"`;
        groupByClause = `GROUP BY ${groupBy}`;
      }
      const whereClause = filter ? 'WHERE ' + filter : '';
      const orderByClause = `ORDER BY "${sortOn}" ${sortAsc ? 'ASC' : 'DESC'}`;
      const query = `SELECT ${columns} FROM DM_getPanel(${panelSource}) ${whereClause} ${groupByClause} ${orderByClause}`;

      const tmp = await makeTmpFile();
      try {
        const body = {
          indexIdMap,
          indexShapeMap,
          ...new SQLPanelInfo('', 'sqlite', '', query),
          connector: new SQLConnectorInfo('', 'sqlite', tmp.path),
        };
        return await evalSQLHandlerInternal(projectId, query, body, dispatch);
      } finally {
        await tmp.cleanup();
      }
    },
  });
