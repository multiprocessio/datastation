import deno from './deno.json';
import { genericPreamble, JAVASCRIPT } from './javascript';

function preamble(
  resultsFile: string,
  panelId: string,
  idMap: Record<string | number, string>
) {
  return genericPreamble(deno.preamble, resultsFile, panelId, idMap);
}

export const DENO = {
  ...JAVASCRIPT,
  name: deno.name,
  defaultPath: deno.defaultPath,
  preamble,
};
