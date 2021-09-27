import { fetchResultsHandler } from './columns';
import { evalHandler } from './eval';
import { killProcessHandler } from './program';

export const panelHandlers = [
  evalHandler,
  fetchResultsHandler,
  killProcessHandler,
];
