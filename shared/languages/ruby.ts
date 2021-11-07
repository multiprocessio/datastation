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
  return `
def DM_getPanel(i)
  require 'json'
  JSON.parse(File.read('${resultsFile}' + ${JSON.stringify(idMap)}[i]))
end
def DM_setPanel(v)
  require 'json'
  File.write('${resultsFile + panelId}', v.to_json)
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
