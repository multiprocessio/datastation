package runner

// GENERATED BY ./runner/scripts/generate_program_type_info.sh. DO NOT MODIFY.

var packedProgramTypeInfo = map[SupportedLanguages]string{
	"clojure":    `{"defaultPath":"clojure","id":"clojure","name":"Clojure","preamble":"\n(ns main\n  (:require [clojure.data.json :as json]))\n\n(defn DM_getPanel [i]\n  (json/read (java.io.FileReader.\n    (str \"$$RESULTS_FILE$$\" (get (json/read-str \"$$JSON_ID_MAP$$\") (.toString i))))))\n\n(defn DM_setPanel [v]\n  (json/write (java.io.FileWriter. \"$$PANEL_RESULTS_FILE$$\") v))\n\n(defn DM_getPanelFile [i]\n  (str \"$$RESULTS_FILE$$\" (get (json/read-str \"$$JSON_ID_MAP$$\") (.toString i))))\n"}`,
	"javascript": `{"defaultPath":"node","id":"javascript","name":"JavaScript","preamble":"\nfunction DM_getPanelFile(i) {\n  return '$$RESULTS_FILE$$'+$$JSON_ID_MAP$$[i];\n}\n\nfunction DM_getPanel(i) {\n  const fs = require('fs');\n  return JSON.parse(fs.readFileSync('$$RESULTS_FILE$$'+$$JSON_ID_MAP$$[i]));\n}\n\nfunction DM_setPanel(v) {\n  const fs = require('fs');\n  const fd = fs.openSync('$$PANEL_RESULTS_FILE$$', 'w');\n  if (Array.isArray(v)) {\n    fs.writeSync(fd, '[');\n    for (let i = 0; i < v.length; i++) {\n      const row = v[i];\n      let rowJSON = JSON.stringify(row);\n      if (i < v.length - 1) {\n        rowJSON += ',';\n      }\n      fs.writeSync(fd, rowJSON);\n    }\n    fs.writeSync(fd, ']');\n  } else {\n    fs.writeSync(fd, JSON.stringify(v));\n  }\n}"}`,
	"julia":      `{"defaultPath":"julia","id":"julia","name":"Julia","preamble":"\ntry\n    import JSON\ncatch e\n    import Pkg\n    Pkg.add(\"JSON\")\n    import JSON\nend\n\nfunction DM_getPanel(i)\n  panelId = JSON.parse(\"$$JSON_ID_MAP_QUOTE_ESCAPED$$\")[string(i)]\n  JSON.parsefile(string(\"$$RESULTS_FILE$$\", panelId))\nend\n\nfunction DM_setPanel(v)\n  open(\"$$PANEL_RESULTS_FILE$$\", \"w\") do f\n    JSON.print(f, v)\n  end\nend\n\nfunction DM_getPanelFile(i)\n  string(\"$$RESULTS_FILE$$\", JSON.parse(\"$$JSON_ID_MAP_QUOTE_ESCAPED$$\")[string(i)])\nend"}`,
	"php":        `{"commandArgs":["-d","display_errors=on"],"defaultPath":"php","id":"php","name":"PHP","preamble":"\n<?php\n\nfunction DM_getPanel($i) {\n  return json_decode(file_get_contents('$$RESULTS_FILE$$' . json_decode('$$JSON_ID_MAP$$', true)[strval($i)]), true);\n}\n\nfunction DM_setPanel($v) {\n  file_put_contents('$$PANEL_RESULTS_FILE$$', json_encode($v));\n}\n\nfunction DM_getPanelFile($i) {\n  return '$$RESULTS_FILE$$' . json_decode('$$JSON_ID_MAP$$', true)[strval($i)];\n}"}`,
	"python":     `{"defaultPath":"python3","id":"python","name":"Python","preamble":"\ndef DM_getPanelFile(i):\n  return r'$$RESULTS_FILE$$'+$$JSON_ID_MAP$$[str(i)]\n\ndef DM_getPanel(i):\n  import json\n  with open(r'$$RESULTS_FILE$$'+$$JSON_ID_MAP$$[str(i)]) as f:\n    return json.load(f)\n\ndef DM_setPanel(v):\n  import json\n  with open(r'$$PANEL_RESULTS_FILE$$', 'w') as f:\n    json.dump(v, f)"}`,
	"r":          `{"defaultPath":"Rscript","id":"r","name":"R","preamble":"\ntryCatch(library(\"rjson\"), error=function(cond) {\n  install.packages(\"rjson\", repos=\"https://cloud.r-project.org\")\n}, finally=library(\"rjson\"))\n\nDM_getPanel <- function(i) {\n  panelId = fromJSON(\"$$JSON_ID_MAP_QUOTE_ESCAPED$$\")[[toString(i)]]\n  fromJSON(file=paste(\"$$RESULTS_FILE$$\", panelId, sep=\"\"))\n}\n\nDM_setPanel <- function(v) {\n  write(toJSON(v), \"$$PANEL_RESULTS_FILE$$\")\n}\n\nDM_getPanelFile <- function(i) {\n  paste(\"$$RESULTS_FILE$$\", fromJSON(\"$$JSON_ID_MAP_QUOTE_ESCAPED$$\")[[toString(i)]], sep=\"\")\n}\n"}`,
	"ruby":       `{"defaultPath":"ruby","id":"ruby","name":"Ruby","preamble":"\ndef DM_getPanel(i)\n  require 'json'\n  JSON.parse(File.read('$$RESULTS_FILE$$' + JSON.parse('$$JSON_ID_MAP$$')[i.to_s]))\nend\n\ndef DM_setPanel(v)\n  require 'json'\n  File.write('$$PANEL_RESULTS_FILE$$', v.to_json)\nend\n\ndef DM_getPanelFile(i)\n  require 'json'\n  '$$RESULTS_FILE$$' + JSON.parse('$$JSON_ID_MAP$$')[i.to_s]\nend\n"}`,
}
