function defaultContent(panelIndex: number) {
  if (panelIndex === 0) {
    return 'result = c()\n# Your logic here\nDM_setPanel(result)';
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
tryCatch(library("rjson"), error=function(cond) {install.packages("rjson", repos="https://cloud.r-project.org")}, finally=library("rjson"))
DM_getPanel <- function(i) {
  panelId = fromJSON("${JSON.stringify(idMap).replaceAll(
    '"',
    '\\"'
  )}")[[toString(i)]]
  fromJSON(file=paste("${resultsFile}", panelId, sep=""))
}
DM_setPanel <- function(v) {
  write(toJSON(v), "${resultsFile + panelId}")
}`;
}

export const R = {
  name: 'R',
  defaultPath: 'Rscript',
  defaultContent,
  preamble,
  exceptionRewriter(msg: string, _: string) {
    return msg;
  },
};
