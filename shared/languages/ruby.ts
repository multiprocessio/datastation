function defaultContent(panelIndex: number) {
  if (panelIndex === 0) {
    return 'DM_setPanel([])';
  }

  return `previous = DM_getPanel(${panelIndex - 1});\nDM_setPanel(previous);`;
}

function preamble(outFile: string, resultsFile: string) {
  return `
def DM_getPanel(i)
  require 'json'
  JSON.parse(File.read('${resultsFile}'))[i]
end
def DM_setPanel(v)
  require 'json'
  File.write('${outFile}', v.to_json)
end`;
}

function exceptionRewriter(msg: string, _: string) {
  return msg;
}

export const RUBY = {
  name: 'Ruby',
  defaultPath: 'ruby',
  defaultContent,
  preamble,
  exceptionRewriter,
};
