import { fetchResultsHandler } from './columns';
import { killProcessHandler, makeEvalHandler } from './eval';

export const panelHandlers = (subprocess?: { node: string; go?: string }) => [
  makeEvalHandler(subprocess),
  fetchResultsHandler,
  killProcessHandler,
];
