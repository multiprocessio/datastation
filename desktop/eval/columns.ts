import fs from 'fs/promises';
import { RPC } from '../../shared/constants';
import { columnsFromObject } from '../../shared/table';
import { getProjectResultsFile } from '../store';
import { rpcEvalHandler } from './eval';

export const evalColumnsHandler = rpcEvalHandler({
  resource: RPC.EVAL_COLUMNS,
  handler: async function (
    projectId: string,
    _1: string,
    {
      indexIdMap,
      panelSource,
      columns,
    }: {
      indexIdMap: Array<string>;
      columns: Array<string>;
      panelSource: number;
    }
  ) {
    const id = indexIdMap[panelSource];
    const projectResultsFile = getProjectResultsFile(projectId);
    const f = await fs.readFile(projectResultsFile + id);
    const value = JSON.parse(f.toString());

    const valueWithRequestedColumns = columnsFromObject(
      value,
      columns,
      panelSource
    );

    return {
      value: valueWithRequestedColumns,
      returnValue: true,
    };
  },
});

export const storeLiteralHandler = rpcEvalHandler({
  resource: RPC.STORE_LITERAL,
  handler: async function (
    projectId: string,
    _1: string,
    { id, value }: { id: string; value: any }
  ) {
    // This should get written to disk by rpcEvalHandler
    return { value };
  },
});

export const fetchResultsHandler = {
  resource: RPC.FETCH_RESULTS,
  handler: async function (
    projectId: string,
    _1: string,
    { id }: { id: string }
  ) {
    const projectResultsFile = getProjectResultsFile(projectId);
    const f = await fs.readFile(projectResultsFile + id);
    return { value: JSON.parse(f.toString()) };
  },
};
