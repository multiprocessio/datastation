function preamble(outFile: string, resultsFile: string) {
  return `
library("rjson")
DM_getPanel <- function(i) {
  fromJSON(file="${resultsFile}")[[i+1]]
}
DM_setPanel <- function(v) {
  write(toJSON(v), "${outFile}")
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
