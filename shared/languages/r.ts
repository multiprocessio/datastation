import { genericPreamble } from './javascript';
import r from './r.json';

function defaultContent(panelIndex: number) {
  if (panelIndex === 0) {
    return 'result = c()\n# Your logic here\nDM_setPanel(result)';
  }

  return `transform = DM_getPanel(${
    panelIndex - 1
  })\n# Your logic here\nDM_setPanel(transform)`;
}

function preamble(
  resultsFile: string,
  panelId: string,
  idMap: Record<string | number, string>
) {
  return genericPreamble(r.preamble, resultsFile, panelId, idMap);
}

export const R = {
  name: r.name,
  defaultPath: r.defaultPath,
  defaultContent,
  preamble,
  exceptionRewriter(msg: string, _: string) {
    return msg;
  },
};
