{
  id: "javascript",
  defaultPath: "node",
  name: "JavaScript",
  preamble: "
function DM_getPanelFile(i) {
  return '$$RESULTS_FILE$$'+$$JSON_ID_MAP$$[i];
}

function DM_getPanel(i) {
  const fs = require('fs');
  return JSON.parse(fs.readFileSync('$$RESULTS_FILE$$'+$$JSON_ID_MAP$$[i]));
}

function DM_setPanel(v) {
  const fs = require('fs');
  const fd = fs.openSync('$$PANEL_RESULTS_FILE$$', 'w');
  if (Array.isArray(v)) {
    fs.writeSync(fd, '[');
    for (let i = 0; i < v.length; i++) {
      const row = v[i];
      let rowJSON = JSON.stringify(row);
      if (i < v.length - 1) {
        rowJSON += ',';
      }
      fs.writeSync(fd, rowJSON);
    }
    fs.writeSync(fd, ']');
  } else {
    fs.writeSync(fd, JSON.stringify(v));
  }
}",
}
