package runner

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path"
	"time"

	"golang.org/x/crypto/nacl/secretbox"

	"github.com/flosch/pongo2"
)

var logPrefixSet = false
var Verbose = true

func _logln(level, msg string, args ...any) {
	if !Verbose {
		return
	}

	if !logPrefixSet {
		log.SetFlags(0)
		logPrefixSet = true
	}
	baseMsg := "[" + level + "] " + time.Now().Format(iso8601Format) + " " + msg
	log.Printf(baseMsg, args...)
}

func Logln(msg string, args ...any) {
	_logln("INFO", msg, args...)
}

func Fatalln(msg string, args ...any) {
	_logln("FATAL", msg, args...)
	os.Exit(2)
}

func (ec EvalContext) panelResultsExist(projectId, panelId string) bool {
	resultsFile := ec.GetPanelResultsFile(projectId, panelId)
	_, err := os.Stat(resultsFile)
	return err == nil
}

func (ec EvalContext) allImportedPanelResultsExist(project ProjectState, page ProjectPage, panel PanelInfo) (string, bool) {
	idMap := getIdMap(page)
	matchesForSubexps := dmGetPanelRe.FindAllStringSubmatch(panel.Content, -1)
	for _, match := range matchesForSubexps {
		nameOrIndex := ""
		for i, name := range dmGetPanelRe.SubexpNames() {
			switch name {
			case "number":
				nameOrIndex = match[i]
			case "singlequote", "doublequote":
				// Remove quotes
				nameOrIndex = match[i]
				if nameOrIndex != "" {
					nameOrIndex = nameOrIndex[1 : len(nameOrIndex)-1]
				}
			}

			if nameOrIndex != "" {
				if !ec.panelResultsExist(project.Id, idMap[nameOrIndex]) {
					return nameOrIndex, false
				}
			}
		}
	}

	return "", true
}

func (ec EvalContext) evalMacros(content string, project *ProjectState, pageIndex int) (string, error) {
	pongoJsonify := func(in *pongo2.Value, _ *pongo2.Value) (*pongo2.Value, *pongo2.Error) {
		bs, err := json.Marshal(in.Interface())
		if err != nil {
			return nil, &pongo2.Error{OrigError: err}
		}

		return pongo2.AsSafeValue(string(bs)), nil
	}

	if pongo2.FilterExists("json") {
		err := pongo2.ReplaceFilter("json", pongoJsonify)
		if err != nil {
			return "", err
		}
	} else {
		err := pongo2.RegisterFilter("json", pongoJsonify)
		if err != nil {
			return "", err
		}
	}

	tpl, err := pongo2.FromString(content)
	if err != nil {
		return "", makeErrBadTemplate(err.Error())
	}

	errC := make(chan error)

	getPanel := func(nameOrIndex string) any {
		panelId := ""
		for panelIndex, panel := range project.Pages[pageIndex].Panels {
			if panel.Name == nameOrIndex || fmt.Sprintf("%d", panelIndex) == nameOrIndex {
				panelId = panel.Id
				break
			}
		}

		if panelId == "" {
			errC <- makeErrInvalidDependentPanel(nameOrIndex)
		}

		resultsFile := ec.GetPanelResultsFile(project.Id, panelId)
		var a any
		err := readJSONFileInto(resultsFile, &a)
		if err != nil {
			errC <- err
			return nil
		}

		return a
	}

	select {
	case err := <-errC:
		return "", err
	default:
		out, err := tpl.Execute(pongo2.Context{"DM_getPanel": getPanel})
		return out, err
	}
}

type EvalContext struct {
	settings Settings
	fsBase   string
	path     string
}

func (ec EvalContext) decrypt(e *Encrypt) (string, error) {
	if !e.Encrypted {
		return e.Value, nil
	}

	if len(e.Value) == 0 {
		return "", nil
	}

	v := e.Value
	keyBytes, err := os.ReadFile(path.Join(ec.fsBase, ".signingKey"))
	if err != nil {
		return "", err
	}

	keyDecoded, err := base64.StdEncoding.DecodeString(string(keyBytes))
	if err != nil {
		return "", err
	}
	messageWithNonceDecoded, err := base64.StdEncoding.DecodeString(string(v))
	if err != nil {
		return "", err
	}

	var nonce [24]byte
	copy(nonce[:24], messageWithNonceDecoded[0:24])
	var key [32]byte
	copy(key[:32], keyDecoded)

	message := messageWithNonceDecoded[24:]

	decrypted, ok := secretbox.Open(nil, message, &nonce, &key)
	if !ok {
		return "", edsef("NACL open failed")
	}

	return string(decrypted), nil
}

func NewEvalContext(s Settings, fsBase string) EvalContext {
	return EvalContext{s, fsBase, ""}
}

func (ec EvalContext) Eval(projectId, panelId string) (error, string) {
	project, pageIndex, panel, err := ec.getProjectPanel(projectId, panelId)
	if err != nil {
		return err, ""
	}

	panelId, ok := ec.allImportedPanelResultsExist(*project, project.Pages[pageIndex], *panel)
	if !ok {
		return makeErrInvalidDependentPanel(panelId), ""
	}

	panel.Content, err = ec.evalMacros(panel.Content, project, pageIndex)
	if err != nil {
		return err, ""
	}

	switch panel.Type {
	case FilePanel:
		Logln("Evaling file panel: " + panel.Name)
		return ec.evalFilePanel(project, pageIndex, panel), ""
	case HttpPanel:
		Logln("Evaling http panel: " + panel.Name)
		return ec.evalHTTPPanel(project, pageIndex, panel), ""
	case LiteralPanel:
		Logln("Evaling literal panel: " + panel.Name)
		return ec.evalLiteralPanel(project, pageIndex, panel), ""
	case ProgramPanel:
		Logln("Evaling program panel: " + panel.Name)
		return ec.evalProgramPanel(project, pageIndex, panel)
	case DatabasePanel:
		Logln("Evaling database panel: " + panel.Name)
		return ec.EvalDatabasePanel(project, pageIndex, panel, nil, *DefaultCacheSettings), ""
	case TablePanel:
		Logln("Evaling table panel: " + panel.Name)
		return ec.evalTablePanel(project, pageIndex, panel), ""
	case GraphPanel:
		Logln("Evaling graph panel: " + panel.Name)
		return ec.evalGraphPanel(project, pageIndex, panel), ""
	}

	return makeErrUnsupported("Unsupported panel type " + string(panel.Type) + " in Go runner"), ""
}
