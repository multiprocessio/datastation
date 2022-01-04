{
  id: "php",
  name: "PHP",
  defaultPath: "php",
  commandArgs: ["-d", "display_errors=on"],
  preamble: "
function DM_getPanel($i) {
  return json_decode(file_get_contents('$$RESULTS_FILE$$' . json_decode('$$JSON_ID_MAP$$')[strval($i)]));
}

function DM_setPanel($v) {
  file_put_contents('$$PANEL_RESULTS_FILE$$', json_encode($v));
}

function DM_getPanelFile($i) {
  return '$$RESULTS_FILE$$' . json_decode('$$JSON_ID_MAP$$')[strval($i)];
}",
}
