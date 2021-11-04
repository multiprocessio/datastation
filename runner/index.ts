import { fetchResultsHandler } from './columns';
import { killProcessHandler, makeEvalHandler } from './eval';

export const panelHandlers = (subprocess?: string) => [
  makeEvalHandler(subprocess),
  fetchResultsHandler,
  killProcessHandler,
];
