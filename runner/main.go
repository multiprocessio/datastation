package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
)

func eval(panelId, projectId string) (*PanelResult, error) {
	project, pageIndex, panel, err := getProjectPanel(projectId, panelId)
	if err != nil {
		return nil, err
	}

	switch panel.Type {
	case FilePanel:
		log.Println("Evaling file panel")
		return evalFilePanel(project, pageIndex, panel)
	case LiteralPanel:
		log.Println("Evaling literal panel")
		return evalLiteralPanel(project, pageIndex, panel)
	case ProgramPanel:
		log.Println("Evaling program panel")
		return evalProgramPanel(project, pageIndex, panel)
	}

	return nil, fmt.Errorf("Unsupported panel type " + string(panel.Type))
}

func fatal(msg string, args ...interface{}) {
	if msg[len(msg)-1] != '\n' {
		msg += "\n"
	}
	fmt.Printf(msg, args...)
	os.Exit(2)
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
		fatal("No project id given.")
	}

	if panelId == "" {
		fatal("No panel id given.")
	}

	if panelMetaOut == "" {
		fatal("No panel meta out given.")
	}

	result, err := eval(panelId, projectId)
	if err != nil {
		fatal("Failed to eval: %s", err)
	}

	// Write result to disk
	file, err := os.OpenFile(panelMetaOut, os.O_WRONLY|os.O_CREATE, os.ModePerm)
	if err != nil {
		fatal("Failed to open panel meta out: %s", err)
	}

	defer file.Close()
	encoder := json.NewEncoder(file)
	err = encoder.Encode(result)
	if err != nil {
		fatal("Failed to encode JSON panel meta out: %s", err)
	}
}
