import { EOL } from './types';

function preamble(
  resultsFile: string,
  panelId: string,
  indexIdMap: Record<number, string>
) {
  return `
import JSON
function DM_getPanel(i)
  panelId = JSON.parse("${JSON.stringify(indexIdMap)}")[i+1]
  JSON.parsefile("${resultsFile}"+panelId)
end
function DM_setPanel(v)
  open("${resultsFile + panelId}", "w") do f
    JSON.print(f, v)
  end
end`;
}

function exceptionRewriter(msg: string, programPath: string) {
  const matcher = RegExp(`${programPath}:([1-9]*)`.replaceAll('/', '\\/'), 'g');

  return msg.replace(matcher, function (_: string, line: string) {
    return `${programPath}:${+line - preamble('', '', {}).split(EOL).length}`;
  });
}

export const JULIA = {
  name: 'Julia',
  defaultPath: 'julia',
  defaultContent: (panelIndex: number) => '',
  preamble,
  exceptionRewriter,
};
