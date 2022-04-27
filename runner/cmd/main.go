package main

import (
	"os"

	"github.com/multiprocessio/datastation/runner"
)

// Overridden during build
var (
	VERSION  = "development"
	APP_NAME = "DataStation Runner (Go)"
)

func main() {
	runner.Verbose = true
	runner.Logln(APP_NAME + " " + VERSION)
	projectId := ""
	panelId := ""
	panelMetaOut := ""
	settingsFile := ""
	fsBase := runner.DEFAULT_FS_BASE

	args := os.Args
	for i := 0; i < len(args)-1; i++ {
		if args[i] == "--fsbase" {
			fsBase = args[i+1]
			i++
			continue
		}

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

		if args[i] == "--settingsFile" {
			settingsFile = args[i+1]
			i++
			continue
		}
	}

	if projectId == "" {
		runner.Fatalln("No project id given.")
	}

	if panelId == "" {
		runner.Fatalln("No panel id given.")
	}

	if panelMetaOut == "" {
		runner.Fatalln("No panel meta out given.")
	}

	if settingsFile == "" {
		settingsFile = runner.SettingsFileDefaultLocation
	}

	settings, err := runner.LoadSettings(settingsFile)
	if err != nil {
		runner.Logln("Could not load settings, assuming defaults.")
		settings = runner.DefaultSettings
	}

	ec := runner.NewEvalContext(*settings, fsBase)

	errToWrite, output := ec.Eval(projectId, panelId)
	if errToWrite != nil {
		runner.Logln("Failed to eval: %s", errToWrite)

		if _, ok := errToWrite.(*runner.DSError); !ok {
			errToWrite = runner.Edse(errToWrite)
			errToWrite.(*runner.DSError).Stack = "Unknown"
		}

		// Explicitly don't fail here so that the parent can read the exception from disk
	}

	err = runner.WriteJSONFile(panelMetaOut, map[string]any{
		"exception": errToWrite,
		"stdout":    output,
	})
	if err != nil {
		runner.Fatalln("Could not write panel meta out: %s", errToWrite)
	}
}
