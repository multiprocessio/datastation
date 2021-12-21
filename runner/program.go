package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path"
	"strings"

	"github.com/google/uuid"
)

type ProgramEvalInfo struct {
	Id          SupportedLanguages `json:"id"`
	Name        string             `json:"name"`
	Preamble    string             `json:"preamble"`
	DefaultPath string             `json:"defaultPath"`
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

func MakeTmpSQLiteConnector() (*ConnectorInfo, *os.File, error) {
	tmp, err := os.CreateTemp("", "sql-program-panel-")
	if err != nil {
		return nil, nil, err
	}

	connector := &ConnectorInfo{
		Type: DatabaseConnector,
		Id:   uuid.New().String(),
		DatabaseConnectorInfo: &DatabaseConnectorInfo{
			Database: DatabaseConnectorInfoDatabase{
				Type:     SQLiteDatabase,
				Database: tmp.Name(),
			},
		},
	}

	return connector, tmp, nil
}

func evalProgramSQLPanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	connector, tmp, err := MakeTmpSQLiteConnector()
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	project.Connectors = append(project.Connectors, connector)

	return evalDatabasePanel(project, pageIndex, &PanelInfo{
		Type:    DatabasePanel,
		Id:      panel.Id,
		Content: panel.Content,
		DatabasePanelInfo: &DatabasePanelInfo{
			Database: DatabasePanelInfoDatabase{
				ConnectorId: connector.Id,
			},
		},
	})
}

func (ec evalContext) evalProgramPanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	if panel.Program.Type == SQL {
		return evalProgramSQLPanel(project, pageIndex, panel)
	}

	var p ProgramEvalInfo
	err := readJSONFileInto(path.Join("shared", "languages", string(panel.Program.Type)+".json"), &p)
	if err != nil {
		return err
	}

	tmp, err := os.CreateTemp("", "program-panel-")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())

	resultsFile := getProjectResultsFile(project.Id)
	panelResultsFile := getPanelResultsFile(project.Id, panel.Id)
	jsonIdMap := getIdMapJson(project.Pages[pageIndex])
	preamble := strings.ReplaceAll(p.Preamble, "$$RESULTS_FILE$$", resultsFile)
	preamble = strings.ReplaceAll(preamble, "$$PANEL_RESULTS_FILE$$", panelResultsFile)
	preamble = strings.ReplaceAll(preamble, "$$JSON_ID_MAP$$", jsonIdMap)
	preamble = strings.ReplaceAll(preamble, "$$JSON_ID_MAP_QUOTE_ESCAPED$$", strings.ReplaceAll(jsonIdMap, "\"", "\\\""))

	body := preamble + "\n" + panel.Content
	_, err = tmp.WriteString(body)
	if err != nil {
		return err
	}

	path := p.DefaultPath
	if ec.settings.Languages != nil && ec.settings.Languages[p.Id].Path != "" {
		path = ec.settings.Languages[p.Id].Path
	}

	cmd := exec.Command(path, tmp.Name())
	cmd.Stderr = os.Stderr
	cmd.Stdout = os.Stdout

	err = cmd.Start()
	if err != nil {
		return err
	}

	return cmd.Wait()
}
