function defaultContent(panelIndex: number) {
  if (panelIndex === 0) {
    return 'DM_setPanel([])';
  }

  return `previous = DM_getPanel(${panelIndex - 1});\nDM_setPanel(previous);`;
}

function preamble(resultsFile: string, panelId: string, indexIdMap: Record<number, string>) {
  return `
def DM_getPanel(i)
  require 'json'
  JSON.parse(File.read('${resultsFile}' + ${JSON.stringify(indexIdMap)}[i]))
end
def DM_setPanel(v)
  require 'json'
  File.write('${resultsFile+panelId}', v.to_json)
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
