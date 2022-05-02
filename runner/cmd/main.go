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

type args struct {
	projectId    string
	panelId      string
	panelMetaOut string
	settingsFile string
	action       string
	fsBase       string
}

func getArgs() args {
	a := args{}
	a.action = "eval"
	a.fsBase = runner.DEFAULT_FS_BASE

	args := os.Args
	for i := 0; i < len(args)-1; i++ {
		if args[i] == "--action" {
			a.action = args[i+1]
			i++
			continue
		}

		if args[i] == "--fsbase" {
			a.fsBase = args[i+1]
			i++
			continue
		}

		if args[i] == "--dsproj" {
			a.projectId = args[i+1]
			i++
			continue
		}

		if args[i] == "--evalPanel" {
			a.panelId = args[i+1]
			i++
			continue
		}

		if args[i] == "--metaFile" {
			a.panelMetaOut = args[i+1]
			i++
			continue
		}

		if args[i] == "--settingsFile" {
			a.settingsFile = args[i+1]
			i++
			continue
		}
	}

	if a.projectId == "" {
		runner.Fatalln("No project id given.")
	}

	if a.panelId == "" {
		runner.Fatalln("No panel id given.")
	}

	if a.panelMetaOut == "" {
		runner.Fatalln("No panel meta out given.")
	}

	if a.settingsFile == "" {
		a.settingsFile = runner.SettingsFileDefaultLocation
	}

	return a
}

func eval(ec runner.EvalContext, projectId, panelId, panelMetaOut string) {
	errToWrite, output := ec.Eval(projectId, panelId)
	if errToWrite != nil {
		runner.Logln("Failed to eval: %s", errToWrite)

		if _, ok := errToWrite.(*runner.DSError); !ok {
			errToWrite = runner.Edse(errToWrite)
			errToWrite.(*runner.DSError).Stack = "Unknown"
		}

		// Explicitly don't fail here so that the parent can read the exception from disk
	}

	err := runner.WriteJSONFile(panelMetaOut, map[string]any{
		"exception": errToWrite,
		"stdout":    output,
	})
	if err != nil {
		runner.Fatalln("Could not write panel meta out: %s", errToWrite)
	}

}

func main() {
	runner.Verbose = true
	runner.Logln(APP_NAME + " " + VERSION)

	args := getArgs()

	settings, err := runner.LoadSettings(args.settingsFile)
	if err != nil {
		runner.Logln("Could not load settings, assuming defaults.")
		settings = runner.DefaultSettings
	}

	ec := runner.NewEvalContext(*settings, args.fsBase)

	switch args.action {
	case "eval":
		eval(ec, args.projectId, args.panelId, args.panelMetaOut)
	default:
		runner.Fatalln("Unknown runner action: " + args.action)
	}
}
