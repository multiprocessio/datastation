import { genericPreamble } from './javascript';
import ruby from './ruby';

function defaultContent(panelIndex: number) {
  if (panelIndex === 0) {
    return 'result = []\n# Your logic here\nDM_setPanel(result)';
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
  return genericPreamble(ruby.preamble, resultsFile, panelId, idMap);
}

function exceptionRewriter(msg: string, _: string) {
  return msg;
}

export const RUBY = {
  name: ruby.name,
  defaultPath: ruby.defaultPath,
  defaultContent,
  preamble,
  exceptionRewriter,
};
