package main

type PanelResult struct {
	Exception   interface{}    `json:"exception" db:"exception"`
	Value       *[]interface{} `json:"value" db:"value"`
	Preview     string         `json:"preview" db:"preview"`
	Stdout      string         `json:"stdout" db:"stdout"`
	Shape       Shape          `json:"shape" db:"shape"`
	ArrayCount  *float64       `json:"arrayCount" db:"arrayCount"`
	Size        *float64       `json:"size" db:"size"`
	ContentType string         `json:"contentType" db:"contentType"`
	Elapsed     *float64       `json:"elapsed" db:"elapsed"`
}

var defaultPanelResult = PanelResult{
	Stdout:      "",
	Shape:       defaultShape,
	Preview:     "",
	Size:        nil,
	ContentType: "unknown",
	Value:       nil,
	Exception:   nil,
	ArrayCount:  nil,
}

type Encrypt struct {
	Value     string `json:"value" db:"value"`
	Encrypted bool   `json:"encrypted" db:"encrypted"`
}

type ServerInfoType string

const (
	SSHAgent      = "ssh-agent"
	SSHPassword   = "password"
	SSHPrivateKey = "private-key"
)

type ServerInfo struct {
	Name           string         `json:"name" db:"name"`
	Address        string         `json:"address" db:"address"`
	Port           float64        `json:"port" db:"port"`
	Type           ServerInfoType `json:"type" db:"type"`
	Username       string         `json:"username" db:"username"`
	Password       Encrypt        `json:"password_encrypt" db:"password_encrypt"`
	PrivateKeyFile string         `json:"privateKeyFile" db:"privateKeyFile"`
	Passphrase     Encrypt        `json:"passphrase_encrypt" db:"passphrase_encrypt"`
	Id             string         `json:"id" db:"id"`
}

var defaultServerInfo = ServerInfo{
	Type:           SSHPrivateKey,
	Name:           "Untitled Server",
	Address:        "",
	Port:           22,
	Username:       "",
	Password:       Encrypt{},
	PrivateKeyFile: "~/.ssh/id_rsa",
	Passphrase:     Encrypt{},
}

type ContentTypeInfo struct {
	Type             string `json:"type" db:"type"`
	CustomLineRegexp string `json:"customLineRegexp" db:"customLineRegexp"`
}

var defaultContentTypeInfo = ContentTypeInfo{}

type PanelInfoType string

const (
	HttpPanel     = "http"
	ProgramPanel  = "program"
	LiteralPanel  = "literal"
	FilePanel     = "file"
	FilaggPanel   = "filagg"
	DatabasePanel = "database"
)

type PanelInfo struct {
	Content    string        `json:"content" db:"content"`
	Type       PanelInfoType `json:"type" db:"type"`
	Name       string        `json:"name" db:"name"`
	Id         string        `json:"id" db:"id"`
	ServerId   string        `json:"serverId" db:"serverId"`
	ResultMeta PanelResult   `json:"resultMeta" db:"resultMeta"`
	*ProgramPanelInfo
	*FilePanelInfo
	*LiteralPanelInfo
	*DatabasePanelInfo
	*HttpPanelInfo
}

type SupportedLanguages string

const (
	Python     SupportedLanguages = "python"
	JavaScript                    = "javascript"
	Ruby                          = "ruby"
	R                             = "r"
	Julia                         = "julia"
	SQL                           = "sql"
)

type ProgramPanelInfo struct {
	Program struct {
		Type SupportedLanguages `json:"type" db:"type"`
	} `json:"program" db:"program"`
}

type FilePanelInfo struct {
	File struct {
		ContentTypeInfo ContentTypeInfo `json:"contentTypeInfo" db:"contentTypeInfo"`
		Name            string          `json:"name" db:"name"`
	} `json:"file" db:"file"`
}

type LiteralPanelInfo struct {
	Literal struct {
		ContentTypeInfo ContentTypeInfo `json:"contentTypeInfo" db:"contentTypeInfo"`
	} `json:"literal" db:"literal"`
}

type HttpPanelInfo struct {
	Http HttpConnectorInfo `json:"http" db:"http"`
}

type DatabasePanelInfoDatabase struct {
	ConnectorId string      `json:"connectorId" db:"connectorId"`
	Range       interface{} `json:"range" db:"range"` // TODO: support these
	Table       string      `json:"table" db:"table"`
	Step        float64     `json:"step" db:"step"`
}

type DatabasePanelInfo struct {
	Database DatabasePanelInfoDatabase `json:"database" db:"database"`
}

type ConnectorInfoType string

const (
	DatabaseConnector ConnectorInfoType = "database"
	HTTPConnector                       = "http"
)

type ConnectorInfo struct {
	Name     string            `json:"name" db:"name"`
	Type     ConnectorInfoType `json:"type" db:"type"`
	Id       string            `json:"id" db:"id"`
	ServerId string            `json:"serverId" db:"serverId"`
	*DatabaseConnectorInfo
}

type DatabaseConnectorInfoType string

const (
	PostgresDatabase      DatabaseConnectorInfoType = "postgres"
	MySQLDatabase                                   = "mysql"
	SQLiteDatabase                                  = "sqlite"
	OracleDatabase                                  = "oracle"
	SQLServerDatabase                               = "sqlserver"
	PrestoDatabase                                  = "presto"
	ClickhouseDatabase                              = "clickhouse"
	SnowflakeDatabase                               = "snowflake"
	CassandraDatabase                               = "cassandra"
	ElasticsearchDatabase                           = "elasticsearch"
	SplunkDatabase                                  = "splunk"
	PrometheusDatabase                              = "prometheus"
	InfluxDatabase                                  = "influx"
)

type DatabaseConnectorInfoDatabase struct {
	Type     DatabaseConnectorInfoType `json:"type" db:"type"`
	Database string                    `json:"database" db:"database"`
	Username string                    `json:"username" db:"username"`
	Password Encrypt                   `json:"password_encrypt" db:"password_encrypt"`
	Address  string                    `json:"address" db:"address"`
	ApiKey   Encrypt                   `json:"apiKey_encrypt" db:"apiKey_encrypt"`
	Extra    map[string]string         `json:"extra" db:"extra"`
}

type DatabaseConnectorInfo struct {
	Database DatabaseConnectorInfoDatabase `json:"database" db:"database"`
}

type HttpConnectorInfoHttp struct {
	Method          string          `json:"method" db:"method"`
	Url             string          `json:"url" db:"url"`
	ContentTypeInfo ContentTypeInfo `json:"contentTypeInfo" db:"contentTypeInfo"`
	Headers         [][]string      `json:"headers" db:"headers"`
}

type HttpConnectorInfo struct {
	Http HttpConnectorInfoHttp `json:"http" db:"http"`
}

type ProjectPage struct {
	Panels    []PanelInfo   `json:"panels" db:"panels"`
	Schedules []interface{} `json:"schedules" db:"schedules"`
	Name      string        `json:"name" db:"name"`
	Id        string        `json:"id" db:"id"`
}

type ProjectState struct {
	Pages      []ProjectPage   `json:"pages" db:"pages"`
	Connectors []ConnectorInfo `json:"connectors" db:"connectors"`
	Servers    []ServerInfo    `json:"servers" db:"servers"`
	Id         string          `json:"projectName" db:"projectName"`
	// Basically never use uuid
	Uuid            string `json:"id" db:"id"`
	OriginalVersion string `json:"originalVersion" db:"originalVersion"`
	LastVersion     string `json:"lastVersion" db:"lastVersion"`
}
