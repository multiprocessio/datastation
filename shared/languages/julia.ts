import { EOL } from './types';

function preamble(outFile: string, resultsFile: string) {
  return `
import JSON
function DM_getPanel(i)
  JSON.parsefile("${resultsFile}")[i+1]
end
function DM_setPanel(v)
  open("${outFile}", "w") do f
    JSON.print(f, v)
  end
end`;
}

function exceptionRewriter(msg: string, programPath: string) {
  const matcher = RegExp(`${programPath}:([1-9]*)`.replaceAll('/', '\\/'), 'g');

  return msg.replace(matcher, function (_: string, line: string) {
    return `${programPath}:${+line - preamble('', '').split(EOL).length}`;
  });
}

export const JULIA = {
  name: 'Julia',
  defaultPath: 'julia',
  defaultContent: (panelIndex: number) => '',
  preamble,
  exceptionRewriter,
};
