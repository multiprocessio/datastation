{
  id: "ruby",
  name: "Ruby",
  defaultPath: "ruby",
  preamble: "
def DM_getPanel(i)
  require 'json'
  JSON.parse(File.read('$$RESULTS_FILE$$' + JSON.parse('$$JSON_ID_MAP$$')[i.to_s]))
end

def DM_setPanel(v)
  require 'json'
  File.write('$$PANEL_RESULTS_FILE$$', v.to_json)
end

def DM_getPanelFile(i)
  require 'json'
  '$$RESULTS_FILE$$' + JSON.parse('$$JSON_ID_MAP$$')[i.to_s]
end
",
}
