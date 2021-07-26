function preamble(resultsFile: string, panelId:string, indexIdMap: Record<number,string>) {
  return `
library("rjson")
DM_getPanel <- function(i) {
  panelId = fromJSON("${JSON.stringify(indexIdMap)}")[[i+1]]
  fromJSON(file="${resultsFile}"+panelId)
}
DM_setPanel <- function(v) {
  write(toJSON(v), "${resultsFile+panelId}")
}`;
}

export const R = {
  name: 'R',
  defaultPath: 'Rscript',
  defaultContent: (panelIndex: number) => '',
  preamble,
  exceptionRewriter(msg: string, _: string) {
    return msg;
  },
};
