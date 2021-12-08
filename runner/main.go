package main

import (
	"fmt"
	"log"
	"os"
)

func eval(panelId, projectId string) error {
	project, pageIndex, panel, err := getProjectPanel(projectId, panelId)
	if err != nil {
		return err
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
	case DatabasePanel:
		log.Println("Evaling database panel")
		return evalDatabasePanel(project, pageIndex, panel)
	}

	return fmt.Errorf("Unsupported panel type " + string(panel.Type))
}

func fatal(msg string, args ...interface{}) {
	if msg[len(msg)-1] != '\n' {
		msg += "\n"
	}
	log.Printf(msg, args...)
	os.Exit(2)
}

const VERSION = "development"
const APP_NAME = "DataStation Runner (Go)"

func main() {
	log.Println(APP_NAME + " " + VERSION)
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

	err := eval(panelId, projectId)
	if err != nil {
		fatal("Failed to eval: %s", err)
	}
}
