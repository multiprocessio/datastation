package runner

import (
	"encoding/json"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
)

var HOME, _ = os.UserHomeDir()
var DEFAULT_FS_BASE = path.Join(HOME, "DataStationProjects")
var CONFIG_FS_BASE = DEFAULT_FS_BASE

func readJSONFileInto(file string, into interface{}) error {
	f, err := os.Open(file)
	if err != nil {
		return err
	}
	defer f.Close()

	decoder := json.NewDecoder(f)
	err = decoder.Decode(into)
	if err == io.EOF {
		return edsef("File is empty")
	}

	return err
}

func WriteJSONFile(file string, value interface{}) error {
	f, err := openTruncate(file)
	if err != nil {
		return err
	}
	defer f.Close()

	encoder := json.NewEncoder(f)
	return encoder.Encode(value)
}

func (ec EvalContext) getProjectFile(projectId string) string {
	ext := ".dsproj"
	if !strings.HasSuffix(projectId, ext) {
		projectId += ext
	}

	if filepath.IsAbs(projectId) {
		return projectId
	}

	return path.Join(ec.fsBase, projectId)
}

func makeErrNoSuchPanel(panelId string) error {
	return edsef("Panel not found: " + panelId)
}

func (ec EvalContext) getProjectPanel(projectId, panelId string) (*ProjectState, int, *PanelInfo, error) {
	if strings.Contains(os.Args[0], "go_server_runner") {
		return getProjectPanelFromDatabase(projectId, panelId)
	}

	file := ec.getProjectFile(projectId)

	var project ProjectState
	err := readJSONFileInto(file, &project)
	if err != nil {
		return nil, 0, nil, err
	}

	for i, page := range project.Pages {
		for _, panel := range page.Panels {
			p := panel
			if panel.Id == panelId {
				return &project, i, &p, nil
			}
		}
	}

	return nil, 0, nil, makeErrNoSuchPanel(panelId)
}

func (ec EvalContext) getProjectResultsFile(projectId string) string {
	project := filepath.Base(projectId)
	// Drop .dsproj from project id
	if strings.HasSuffix(project, ".dsproj") {
		project = project[0 : len(project)-len(".dsproj")]
	}
	return strings.ReplaceAll(path.Join(ec.fsBase, "."+project+".results"), "\\", "/")
}

func (ec EvalContext) GetPanelResultsFile(projectId string, panelId string) string {
	return ec.getProjectResultsFile(projectId) + panelId
}
