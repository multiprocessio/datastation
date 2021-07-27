import fs from 'fs/promises';
import { RPC } from '../../shared/constants';
import { columnsFromObject } from '../../shared/object';
import { getProjectResultsFile } from '../store';
import { rpcEvalHandler } from './eval';

export const evalColumnsHandler = rpcEvalHandler({
  resource: RPC.EVAL_COLUMNS,
  handler: async function (
    projectId: string,
    _1: string,
    {
      id,
      columns,
    }: {
      id: string;
      columns: Array<string>
    }
  ) {
    const projectResultsFile = getProjectResultsFile(projectId);
    const f = await fs.readFile(projectResultsFile + id);
    const value = JSON.parse(f.toString());

    const valueWithRequestedColumns = columnsFromObject(value, columns);

    return {
      value: valueWithRequestedColumns,
      returnValue: true,
    };
  },
});

export const storeLiteralHandler = rpcEvalHandler({
  resource: RPC.STORE_LITERAL,
  handler: function (_: string, _1: string, { value }: { value: any }) {
    return Promise.resolve({ value });
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
