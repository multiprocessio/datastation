package main

import (
	"encoding/json"
	"fmt"
	"os"
)

func eval(panelId, projectId string) (*PanelResult, error) {
	project, pageIndex, panel, err := getProjectPanel(projectId, panelId)
	if err != nil {
		return nil, err
	}

	switch panel.Type {
	case FilePanel:
		return evalFilePanel(project, pageIndex, panel)
	case LiteralPanel:
		return evalLiteralPanel(project, pageIndex, panel)
	case ProgramPanel:
		return evalProgramPanel(project, pageIndex, panel)
	}

	return nil, fmt.Errorf("Unsupported panel type " + string(panel.Type))
}

func main() {
	projectId := ""
	panelId := ""
	panelMetaOut := ""

	args := os.Args
	for i := 0; i < len(args)-1; i++ {
		if args[i] == "--dsproj" {
			projectId = args[i+1]
			i++
			continue
		}

		if args[i] == "--evalPanel" {
			panelId = args[i+1]
			i++
			continue
		}

		if args[i] == "--metaFile" {
			panelMetaOut = args[i+1]
			i++
			continue
		}
	}

	if projectId == "" {
		panic("No project id given.")
	}

	if panelId == "" {
		panic("No panel id given.")
	}

	if panelMetaOut == "" {
		panic("No panel meta out given.")
	}

	result, err := eval(panelId, projectId)
	if err != nil {
		panic(err)
	}

	// Write result to disk
	file, err := os.OpenFile(panelMetaOut, os.O_WRONLY|os.O_CREATE, os.ModePerm)
	if err != nil {
		panic(err)
	}

	defer file.Close()
	encoder := json.NewEncoder(file)
	err = encoder.Encode(result)
	if err != nil {
		panic(err)
	}
}
