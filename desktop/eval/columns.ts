import fs from 'fs/promises';
import { RPC } from '../../shared/constants';
import { EvalColumnsBody } from '../../shared/rpc';
import { columnsFromObject } from '../../shared/table';
import { getProjectResultsFile } from '../store';
import { rpcEvalHandler } from './eval';

export const evalColumnsHandler = rpcEvalHandler<EvalColumnsBody>({
  resource: RPC.EVAL_COLUMNS,
  handler: async function (
    projectId: string,
    _1: string,
    { id, columns, panelSource }: EvalColumnsBody
  ) {
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

export const storeLiteralHandler = rpcEvalHandler<{
  value: string;
  id: string;
}>({
  resource: RPC.STORE_LITERAL,
  handler: async function (
    projectId: string,
    _1: string,
    { value }: { value: any }
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
