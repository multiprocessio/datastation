package main

import (
	"log"
	"os"
	"time"
)

var iso8601Format = "2006-01-02T15:04:05.999Z"
var logPrefixSet = false

func _logln(level, msg string, args ...interface{}) {
	if !logPrefixSet {
		log.SetFlags(0)
		logPrefixSet = true
	}
	baseMsg := "[" + level + "] " + time.Now().Format(iso8601Format) + " " + msg
	if msg[len(msg)-1] != '\n' {
		msg += "\n"
	}
	log.Printf(baseMsg, args...)
}

func logln(msg string, args ...interface{}) {
	_logln("INFO", msg, args...)
}

func fatalln(msg string, args ...interface{}) {
	_logln("FATAL", msg, args...)
	os.Exit(2)
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
		fatalln("No project id given.")
	}

	if panelId == "" {
		fatalln("No panel id given.")
	}

	if panelMetaOut == "" {
		fatalln("No panel meta out given.")
	}

	settings, err := loadSettings()
	if err != nil {
		logln("Could not load settings, assuming defaults.")
		settings = defaultSettings
	}

	ec := evalContext{*settings}

	err = ec.eval(panelId, projectId)
	if err != nil {
		logln("Failed to eval: %s", err)

		if _, ok := err.(*DSError); !ok {
			err = edse(err)
			err.(*DSError).Stack = "Unknown"
		}

		err := writeJSONFile(panelMetaOut, map[string]interface{}{
			"exception": err,
		})
		if err != nil {
			fatalln("Could not write panel meta out: %s", err)
		}

		// Explicitly don't fail here so that the parent can read the exception from disk
	}
}
