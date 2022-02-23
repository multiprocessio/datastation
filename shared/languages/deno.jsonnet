{
  id: "deno",
  defaultPath: "deno",
  commandArgs: ["run", "--allow-all"],
  name: "Deno",
  preamble: "
function DM_getPanelFile(i) {
  return '$$RESULTS_FILE$$'+$$JSON_ID_MAP$$[i];
}

function DM_getPanel(i) {
  return JSON.parse(Deno.readTextFileSync('$$RESULTS_FILE$$'+$$JSON_ID_MAP$$[i]));
}

function DM_setPanel(v) {
  Deno.writeTextFileSync('$$PANEL_RESULTS_FILE$$', JSON.stringify(v));
}",
}
