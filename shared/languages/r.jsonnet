{
  id: "r",
  name: "R",
  defaultPath: "Rscript",
  preamble: '
tryCatch(library("rjson"), error=function(cond) {
  install.packages("rjson", repos="https://cloud.r-project.org")
}, finally=library("rjson"))

DM_getPanel <- function(i) {
  panelId = fromJSON("$$JSON_ID_MAP_QUOTE_ESCAPED$$")[[toString(i)]]
  fromJSON(file=paste("$$RESULTS_FILE$$", panelId, sep=""))
}

DM_setPanel <- function(v) {
  write(toJSON(v), "$$PANEL_RESULTS_FILE$$")
}

DM_getPanelFile <- function(i) {
  paste("$$RESULTS_FILE$$", fromJSON("$$JSON_ID_MAP_QUOTE_ESCAPED$$")[[toString(i)]], sep="")
}
',
}
