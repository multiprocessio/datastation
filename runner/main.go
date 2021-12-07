package main

import (
	"encoding/json"
	"os"
)

func eval(panelId, projectId string) (*panelResult, error) {
	project, pageIndex, panel, err := getProjectPanel(projectId, panelId)
	if err != nil {
		return nil, err
	}

	switch panel.Type {
	case FilePanel:
		return evalFilePanel(project, pageIndex, panel)
	case ProgramPanel:
		return evalProgramPanel(project, pageIndex, panel)
	}
}

func main() {
	projectId := ""
	panelId := ""
	panelMetaOut := ""

	args := os.Args
	for i := 0; i < args.length-1; i++ {
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
