{
  id: "julia",
  name: "Julia",
  defaultPath: "julia",
  preamble: '
try
    import JSON
catch e
    import Pkg
    Pkg.add("JSON")
    import JSON
end

function DM_getPanel(i)
  panelId = JSON.parse("$$JSON_ID_MAP_QUOTE_ESCAPED$$")[string(i)]
  JSON.parsefile(string("$$RESULTS_FILE$$", panelId))
end

function DM_setPanel(v)
  open("$$PANEL_RESULTS_FILE$$", "w") do f
    JSON.print(f, v)
  end
end

function DM_getPanelFile(i)
  string("$$RESULTS_FILE$$", JSON.parse("$$JSON_ID_MAP_QUOTE_ESCAPED$$")[string(i)])
end',
}
