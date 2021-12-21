package runner

import (
	"encoding/json"
	"io/ioutil"

	"github.com/goccy/go-yaml"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

type ServerDatabaseConfig struct {
	Address  string `yaml:"address"`
	Username string `yaml:"username"`
	Password string `yaml:"password"`
	Database string `yaml:"database"`
}

type ServerConfig struct {
	Database ServerDatabaseConfig `yaml:"database"`
}

func readYAMLFileInto(file string, into interface{}) error {
	bs, err := ioutil.ReadFile(file)
	if err != nil {
		return edse(err)
	}

	err = yaml.Unmarshal(bs, into)
	if err != nil {
		return edse(err)
	}

	return nil
}

func getProjectPanelFromDatabase(projectId, panelId string) (*ProjectState, int, *PanelInfo, error) {
	var sc ServerConfig
	err := readYAMLFileInto("/etc/datastation/config.yaml", &sc)
	if err != nil {
		return nil, 0, nil, err
	}
	sdc := sc.Database

	vendor, connStr, err := getConnectionString(DatabaseConnectorInfoDatabase{
		Type:     PostgresDatabase,
		Database: sdc.Database,
		Address:  sdc.Address,
		Username: sdc.Username,
		Password: Encrypt{Value: sdc.Password, Encrypted: false},
	})
	db, err := sqlx.Open(vendor, connStr)
	if err != nil {
		return nil, 0, nil, err
	}

	query := "SELECT project_value FROM projects WHERE project_name = $1;"
	var projectJSON []byte
	err = db.QueryRowx(query, projectId).Scan(&projectJSON)
	if err != nil {
		return nil, 0, nil, err
	}

	var project ProjectState
	err = json.Unmarshal(projectJSON, &project)
	if err != nil {
		return nil, 0, nil, err
	}

	for i, p := range project.Pages {
		for _, panel := range p.Panels {
			if panel.Id == panelId {
				cp := panel
				return &project, i, &cp, nil
			}
		}
	}

	return nil, 0, nil, makeErrNoSuchPanel(panelId)
}
