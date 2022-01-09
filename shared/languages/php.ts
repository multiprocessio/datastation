import { genericPreamble } from './javascript';
import php from './php.json';

function defaultContent(panelIndex: number) {
  if (panelIndex === 0) {
    return `$result = [];
// Your logic here
DM_setPanel($result);
`;
  }

  return `$transform = DM_getPanel(${panelIndex - 1});
// Your logic here
DM_setPanel($transform);`;
}

function preamble(
  resultsFile: string,
  panelId: string,
  idMap: Record<string | number, string>
) {
  return genericPreamble(php.preamble, resultsFile, panelId, idMap);
}

function exceptionRewriter(msg: string, _: string) {
  return msg;
}

export const PHP = {
  name: php.name,
  defaultPath: php.defaultPath,
  defaultContent,
  preamble,
  exceptionRewriter,
};
