package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path"
)

var home, _ = os.UserHomeDir()
var base = path.Join(home, "DataStationProjects")

func getProjectPanel(projectId, panelId string) (*ProjectState, int, *PanelInfo, error) {
	file := path.Join(base, projectId)
	if projectId[0] == '/' {
		file = projectId
	}
	f, err := os.Open(file)
	if err != nil {
		return nil, 0, nil, err
	}

	decoder := json.NewDecoder(f)
	var project ProjectState
	err = decoder.Decode(&project)
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

func getPanelResultsFile(projectId string, panel *PanelInfo) string {
	return path.Join(base, "."+projectId+".results"+panel.Id)
}
