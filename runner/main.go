package main

import (
	"fmt"
	"log"
	"os"
	"time"
)

func fatal(msg string, args ...interface{}) {
	if msg[len(msg)-1] != '\n' {
		msg += "\n"
	}
	log.Printf(msg, args...)
	os.Exit(2)
}

var logPrefixSet = false

func logln(msg string, args ...interface{}) {
	if !logPrefixSet {
		log.SetPrefix("")
		logPrefixSet = true
	}
	baseMsg := "[INFO] " + time.Now().Format(time.RFC3339) + " " + msg
	if msg[len(msg)-1] != '\n' {
		msg += "\n"
	}
	log.Printf(baseMsg, args...)
}

func eval(panelId, projectId string) error {
	project, pageIndex, panel, err := getProjectPanel(projectId, panelId)
	if err != nil {
		return err
	}

	switch panel.Type {
	case FilePanel:
		logln("Evaling file panel")
		return evalFilePanel(project, pageIndex, panel)
	case HttpPanel:
		logln("Evaling http panel")
		return evalHttpPanel(project, pageIndex, panel)
	case LiteralPanel:
		logln("Evaling literal panel")
		return evalLiteralPanel(project, pageIndex, panel)
	case ProgramPanel:
		logln("Evaling program panel")
		return evalProgramPanel(project, pageIndex, panel)
	case DatabasePanel:
		logln("Evaling database panel")
		return evalDatabasePanel(project, pageIndex, panel)
	}

	return fmt.Errorf("Unsupported panel type " + string(panel.Type))
}

const VERSION = "development"
const APP_NAME = "DataStation Runner (Go)"

func main() {
	logln(APP_NAME + " " + VERSION)
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
