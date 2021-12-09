import { genericPreamble } from './javascript';
import julia from './julia.json';
import { EOL } from './types';

function preamble(
  resultsFile: string,
  panelId: string,
  idMap: Record<string | number, string>
) {
  return genericPreamble(julia.preamble, resultsFile, panelId, idMap);
}

function defaultContent(panelIndex: number) {
  if (panelIndex === 0) {
    return 'result = []\n# Your logic here\nDM_setPanel(result)';
  }

  return 'transform = DM_getPanel(0)\n# Your logic here\nDM_setPanel(transform)';
}

function exceptionRewriter(msg: string, programPath: string) {
  const matcher = RegExp(`${programPath}:([1-9]*)`.replaceAll('/', '\\/'), 'g');

  return msg.replace(matcher, function (_: string, line: string) {
    return `${programPath}:${+line - preamble('', '', {}).split(EOL).length}`;
  });
}

export const JULIA = {
  name: julia.name,
  defaultPath: julia.defaultPath,
  defaultContent,
  preamble,
  exceptionRewriter,
};
