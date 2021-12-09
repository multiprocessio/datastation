package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path"
	"strings"
)

type ProgramEvalInfo struct {
	Preamble    string `json:"preamble"`
	DefaultPath string `json:"defaultPath"`
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

func evalProgramSQLPanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	tmp, err := os.CreateTemp("", "sql-program-panel-")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())

	return nil
}

func evalProgramPanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	if panel.Program.Type == "sql" {
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

	resultsFile := getProjectResultsFile(project.ProjectName)
	panelResultsFile := getPanelResultsFile(project.ProjectName, panel.Id)
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

	// TODO: support defaultPath overrides
	path := p.DefaultPath

	cmd := exec.Command(path, tmp.Name())
	cmd.Stderr = os.Stderr
	cmd.Stdout = os.Stdout

	err = cmd.Start()
	if err != nil {
		return err
	}

	return cmd.Wait()
}
