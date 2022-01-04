{
  id: "php",
  name: "PHP",
  defaultPath: "php",
  commandArgs: ["-d", "display_errors=on"],
  preamble: "
<?php

function DM_getPanel($i) {
  return json_decode(file_get_contents('$$RESULTS_FILE$$' . json_decode('$$JSON_ID_MAP$$', true)[strval($i)]), true);
}

function DM_setPanel($v) {
  file_put_contents('$$PANEL_RESULTS_FILE$$', json_encode($v));
}

function DM_getPanelFile($i) {
  return '$$RESULTS_FILE$$' . json_decode('$$JSON_ID_MAP$$', true)[strval($i)];
}",
}
