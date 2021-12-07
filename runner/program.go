package main

import (
	"os"
	"os/exec"
	"path"
)

type ProgramEvalInfo struct {
	Preamble    string `json:"preamble"`
	DefaultPath string `json:"defaultPath"`
}

func evalProgramPanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	var p ProgramEvalInfo
	err := readJSONFileInto(path.Join("shared", "languages", string(panel.Program.Type)+".json"), &p)
	if err != nil {
		return err
	}

	tmp, err := os.CreateTemp("", "program-panel-")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())

	_, err = tmp.Write([]byte(p.Preamble + "\n" + panel.Content))
	if err != nil {
		return err
	}

	// TODO: support defaultPath overrides
	path := p.DefaultPath

	out, err := exec.Command(path, tmp.Name()).Output()
	os.Stdout.Write(out)
	return err
}
