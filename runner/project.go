package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
)

var HOME, _ = os.UserHomeDir()
var FS_BASE = path.Join(HOME, "DataStationProjects")

func readJSONFileInto(file string, into interface{}) error {
	f, err := os.Open(file)
	if err != nil {
		return err
	}
	defer f.Close()

	decoder := json.NewDecoder(f)
	err = decoder.Decode(into)
	if err == io.EOF {
		return fmt.Errorf("Project file is empty")
	}

	return err
}

func getProjectFile(projectId string) string {
	ext := ".dsproj"
	if !strings.HasSuffix(projectId, ext) {
		projectId += ext
	}

	if filepath.IsAbs(projectId) {
		return projectId
	}

	return path.Join(FS_BASE, projectId)
}

func getProjectPanel(projectId, panelId string) (*ProjectState, int, *PanelInfo, error) {
	file := getProjectFile(projectId)

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

	return nil, 0, nil, fmt.Errorf("Panel not found")
}

func getProjectResultsFile(projectId string) string {
	project := filepath.Base(projectId)
	// Drop .dsproj from project id
	if strings.HasSuffix(project, ".dsproj") {
		project = project[0 : len(project)-len(".dsproj")]
	}
	return strings.ReplaceAll(path.Join(FS_BASE, "."+project+".results"), "\\", "/")
}

func getPanelResultsFile(projectId string, panelId string) string {
	return getProjectResultsFile(projectId) + panelId
}