{
  id: "python",
  name: "Python",
  defaultPath: "python3",
  preamble: "
def DM_getPanelFile(i):
  return r'$$RESULTS_FILE$$'+$$JSON_ID_MAP$$[str(i)]

def DM_getPanel(i):
  import json
  with open(r'$$RESULTS_FILE$$'+$$JSON_ID_MAP$$[str(i)]) as f:
    return json.load(f)

def DM_setPanel(v):
  import json
  with open(r'$$PANEL_RESULTS_FILE$$', 'w') as f:
    json.dump(v, f)",
}
