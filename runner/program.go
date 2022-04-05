package runner

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

type ProgramEvalInfo struct {
	Id          SupportedLanguages `json:"id"`
	Name        string             `json:"name"`
	Preamble    string             `json:"preamble"`
	DefaultPath string             `json:"defaultPath"`
	CommandArgs []string           `json:"commandArgs"`
}

func getIdMap(page ProjectPage) map[string]string {
	m := map[string]string{}
	for i, panel := range page.Panels {
		m[panel.Name] = panel.Id
		m[fmt.Sprintf("%d", i)] = panel.Id
	}

	return m
}

func getIdShapeMap(page ProjectPage) map[string]Shape {
	m := map[string]Shape{}
	for i, panel := range page.Panels {
		m[panel.Name] = panel.ResultMeta.Shape
		m[fmt.Sprintf("%d", i)] = panel.ResultMeta.Shape
	}

	return m
}

func getIdMapJson(page ProjectPage) string {
	idMap := getIdMap(page)
	bts, _ := json.Marshal(idMap)
	return string(bts)
}

func MakeTmpSQLiteConnector() (*ConnectorInfo, error) {
	connector := &ConnectorInfo{
		Type: DatabaseConnector,
		Id:   newId(),
		DatabaseConnectorInfo: &DatabaseConnectorInfo{
			Database: DatabaseConnectorInfoDatabase{
				Type:     SQLiteDatabase,
				Database: ":memory:",
			},
		},
	}

	return connector, nil
}

func (ec EvalContext) evalProgramSQLPanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	connector, err := MakeTmpSQLiteConnector()
	if err != nil {
		return err
	}
	project.Connectors = append(project.Connectors, *connector)

	return ec.EvalDatabasePanel(project, pageIndex, &PanelInfo{
		Type:    DatabasePanel,
		Id:      panel.Id,
		Content: panel.Content,
		DatabasePanelInfo: &DatabasePanelInfo{
			Database: DatabasePanelInfoDatabase{
				ConnectorId: connector.Id,
			},
		},
	}, nil)
}

func (ec EvalContext) evalProgramPanel(project *ProjectState, pageIndex int, panel *PanelInfo) (error, string) {
	if panel.Program.Type == SQL {
		return ec.evalProgramSQLPanel(project, pageIndex, panel), ""
	}

	var p ProgramEvalInfo
	if panel.Program.Type != CustomProgram {
		err := json.Unmarshal([]byte(packedProgramTypeInfo[panel.Program.Type]), &p)
		if err != nil {
			return edsef("Invalid program type: %s", panel.Program.Type), ""
		}
	}

	tmp, err := os.CreateTemp("", "program-panel-")
	if err != nil {
		return edse(err), ""
	}
	defer os.Remove(tmp.Name())

	resultsFile := ec.getProjectResultsFile(project.Id)
	panelResultsFile := ec.GetPanelResultsFile(project.Id, panel.Id)
	jsonIdMap := getIdMapJson(project.Pages[pageIndex])
	preamble := strings.ReplaceAll(p.Preamble, "$$RESULTS_FILE$$", resultsFile)
	preamble = strings.ReplaceAll(preamble, "$$PANEL_RESULTS_FILE$$", panelResultsFile)
	preamble = strings.ReplaceAll(preamble, "$$JSON_ID_MAP$$", jsonIdMap)
	preamble = strings.ReplaceAll(preamble, "$$JSON_ID_MAP_QUOTE_ESCAPED$$", strings.ReplaceAll(jsonIdMap, "\"", "\\\""))

	body := preamble + "\n" + panel.Content
	_, err = tmp.WriteString(body)
	if err != nil {
		return err, ""
	}

	args := append(p.CommandArgs, tmp.Name())

	path := p.DefaultPath
	if ec.settings.Languages != nil && ec.settings.Languages[p.Id].Path != "" {
		path = strings.TrimSpace(ec.settings.Languages[p.Id].Path)

		if strings.Contains(path, " ") {
			bits := strings.Split(path, " ")
			path = bits[0]
			args = bits[1:]
		}
	}

	if panel.Program.Type == CustomProgram {
		args = nil
		path = strings.ReplaceAll(panel.Program.CustomExe, "{}", tmp.Name())
		if strings.Contains(path, " ") {
			bits := strings.Split(path, " ")
			path = bits[0]
			args = bits[1:]
		}
	}

	Logln("Running program: %s %v", path, args)
	combined, err := exec.Command(path, args...).CombinedOutput()
	maxSize := 100_000
	if ec.settings.StdoutMaxSize > 0 {
		maxSize = ec.settings.StdoutMaxSize
	}

	if len(combined) > maxSize {
		return err, string(combined[:maxSize]) + "..."
	}

	return err, string(combined)
}
