import { fetchResultsHandler } from './columns';
import { killProcessHandler, makeEvalHandler } from './eval';

export const panelHandlers = (runner: string) => [
  makeEvalHandler(runner),
  fetchResultsHandler,
  killProcessHandler,
];
