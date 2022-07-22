package runner

import (
	"database/sql"
	"os"
	"path"
	"path/filepath"
	"strings"

	_ "github.com/mattn/go-sqlite3"
)

var HOME, _ = os.UserHomeDir()
var DEFAULT_FS_BASE = path.Join(HOME, "DataStationProjects")
var CONFIG_FS_BASE = DEFAULT_FS_BASE

func (ec EvalContext) getProjectFile(projectId string) string {
	ext := ".dsproj"
	if !strings.HasSuffix(projectId, ext) {
		projectId += ext
	}

	if filepath.IsAbs(projectId) {
		return projectId
	}

	return path.Join(ec.fsBase, projectId)
}

func makeErrNoSuchPanel(panelId string) error {
	return edsef("Panel not found: " + panelId)
}

func (ec EvalContext) getPagesFromDatabase(db *sql.DB) ([]ProjectPage, error) {
	rows, err := db.Query(`SELECT data_json FROM "ds_page" ORDER BY position ASC`)
	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var j []byte
	var pages []ProjectPage

	for rows.Next() {
		err = rows.Scan(&j)
		if err != nil {
			return nil, err
		}

		var p ProjectPage
		err = jsonUnmarshal(j, &p)
		if err != nil {
			return nil, err
		}

		pages = append(pages, p)
	}

	return pages, nil
}

func (ec EvalContext) getPanelsFromDatabase(db *sql.DB) (map[string][]PanelInfo, error) {
	rows, err := db.Query(`SELECT data_json FROM "ds_panel" ORDER BY position ASC`)
	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var j []byte
	panelPageMap := map[string][]PanelInfo{}

	for rows.Next() {
		err = rows.Scan(&j)
		if err != nil {
			return nil, err
		}

		var p PanelInfo
		err = jsonUnmarshal(j, &p)
		if err != nil {
			return nil, err
		}

		panelPageMap[p.PageId] = append(panelPageMap[p.PageId], p)
	}

	return panelPageMap, nil
}

func (ec EvalContext) getResultsFromDatabase(db *sql.DB) (map[string]PanelResult, error) {
	rows, err := db.Query(`SELECT
  panel_id,
  (
    SELECT data_json
    FROM ds_result i
    WHERE i.panel_id = o.panel_id
    ORDER BY created_at DESC
    LIMIT 1
  ) data_json
FROM ds_result o
GROUP BY panel_id`)
	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var panelId string
	var j []byte
	results := map[string]PanelResult{}

	for rows.Next() {
		err = rows.Scan(&panelId, &j)
		if err != nil {
			return nil, err
		}

		var p PanelResult
		err = jsonUnmarshal(j, &p)
		if err != nil {
			return nil, err
		}

		results[panelId] = p
	}

	return results, nil
}

func (ec EvalContext) getConnectorsFromDatabase(db *sql.DB) ([]ConnectorInfo, error) {
	rows, err := db.Query(`SELECT data_json FROM "ds_connector" ORDER BY position ASC`)
	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var j []byte
	var connectors []ConnectorInfo

	for rows.Next() {
		err = rows.Scan(&j)
		if err != nil {
			return nil, err
		}

		var p ConnectorInfo
		err = jsonUnmarshal(j, &p)
		if err != nil {
			return nil, err
		}

		connectors = append(connectors, p)
	}

	return connectors, nil
}

func (ec EvalContext) getServersFromDatabase(db *sql.DB) ([]ServerInfo, error) {
	rows, err := db.Query(`SELECT data_json FROM "ds_server" ORDER BY position ASC`)
	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var j []byte
	var servers []ServerInfo

	for rows.Next() {
		err = rows.Scan(&j)
		if err != nil {
			return nil, err
		}

		var p ServerInfo
		err = jsonUnmarshal(j, &p)
		if err != nil {
			return nil, err
		}

		servers = append(servers, p)
	}

	return servers, nil
}

func (ec EvalContext) getProjectPanel(projectId, panelId string) (*ProjectState, int, *PanelInfo, error) {
	file := ec.getProjectFile(projectId)

	var project ProjectState
	project.Id = projectId

	db, err := sql.Open("sqlite3", file)
	if err != nil {
		return nil, 0, nil, err
	}

	project.Pages, err = ec.getPagesFromDatabase(db)
	if err != nil {
		return nil, 0, nil, err
	}

	project.Servers, err = ec.getServersFromDatabase(db)
	if err != nil {
		return nil, 0, nil, err
	}

	project.Connectors, err = ec.getConnectorsFromDatabase(db)
	if err != nil {
		return nil, 0, nil, err
	}

	panels, err := ec.getPanelsFromDatabase(db)
	if err != nil {
		return nil, 0, nil, err
	}

	results, err := ec.getResultsFromDatabase(db)
	if err != nil {
		return nil, 0, nil, err
	}

	thisPage := -1
	var thisPanel PanelInfo
	for i, page := range project.Pages {
		// Need to assign directly, not to the copy
		project.Pages[i].Panels = panels[page.Id]
		page = project.Pages[i]

		for j, panel := range page.Panels {
			// Need to assign directly, not to the copy
			project.Pages[i].Panels[j].ResultMeta = results[panel.Id]

			if panel.Id == panelId {
				thisPanel = panel
				thisPage = i
			}
		}
	}

	if thisPage == -1 {
		return nil, 0, nil, makeErrNoSuchPanel(panelId)
	}

	return &project, thisPage, &thisPanel, nil
}

func (ec EvalContext) getProjectResultsFile(projectId string) string {
	project := filepath.Base(projectId)
	// Drop .dsproj from project id
	project = strings.TrimSuffix(project, ".dsproj")

	return strings.ReplaceAll(path.Join(ec.fsBase, "."+project+".results"), "\\", "/")
}

func (ec EvalContext) GetPanelResultsFile(projectId string, panelId string) string {
	return ec.getProjectResultsFile(projectId) + panelId
}
