function preamble(
  resultsFile: string,
  panelId: string,
  indexIdMap: Array<string>
) {
  return `
tryCatch(library("rjson"), error=function(cond) {install.packages("rjson", repos="https://cloud.r-project.org")}, finally=library("rjson"))
DM_getPanel <- function(i) {
  panelId = fromJSON("${JSON.stringify(indexIdMap).replaceAll(
    '"',
    '\\"'
  )}")[[i+1]]
  fromJSON(file=paste("${resultsFile}", panelId, sep=""))
}
DM_setPanel <- function(v) {
  write(toJSON(v), "${resultsFile + panelId}")
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
