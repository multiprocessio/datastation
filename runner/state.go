package runner

import (
	"fmt"
	"time"
)

type PanelResult struct {
	Exception   any      `json:"exception" db:"exception"`
	Preview     string   `json:"preview" db:"preview"`
	Stdout      string   `json:"stdout" db:"stdout"`
	Shape       Shape    `json:"shape" db:"shape"`
	ArrayCount  *float64 `json:"arrayCount" db:"arrayCount"`
	Size        *float64 `json:"size" db:"size"`
	ContentType string   `json:"contentType" db:"contentType"`
	Elapsed     *float64 `json:"elapsed" db:"elapsed"`
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

type ContentTypeInfo struct {
	Type             string `json:"type" db:"type"`
	CustomLineRegexp string `json:"customLineRegexp" db:"customLineRegexp"`
	ConvertNumbers   bool   `json:"convertNumbers" db:"convertNumbers"`
}

type PanelInfoType string

const (
	HttpPanel     = "http"
	ProgramPanel  = "program"
	LiteralPanel  = "literal"
	FilePanel     = "file"
	FilaggPanel   = "filagg"
	DatabasePanel = "database"
	GraphPanel    = "graph"
	TablePanel    = "table"
)

type PanelInfo struct {
	Page       int           `json:"page" db:"page"`
	PageSize   int           `json:"pageSize" db:"pageSize"`
	Content    string        `json:"content" db:"content"`
	Type       PanelInfoType `json:"type" db:"type"`
	Name       string        `json:"name" db:"name"`
	Id         string        `json:"id" db:"id"`
	ServerId   string        `json:"serverId" db:"serverId"`
	ResultMeta PanelResult   `json:"resultMeta" db:"resultMeta"`
	PageId     string        `json:"pageId" db:"pageId"`
	*ProgramPanelInfo
	*FilePanelInfo
	*LiteralPanelInfo
	*DatabasePanelInfo
	*HttpPanelInfo
	*FilaggPanelInfo
	*TablePanelInfo
	*GraphPanelInfo
}

type SupportedLanguages string

const (
	Python        SupportedLanguages = "python"
	JavaScript    SupportedLanguages = "javascript"
	Deno          SupportedLanguages = "deno"
	Ruby          SupportedLanguages = "ruby"
	R             SupportedLanguages = "r"
	Julia         SupportedLanguages = "julia"
	SQL           SupportedLanguages = "sql"
	CustomProgram SupportedLanguages = "custom"
)

type ProgramPanelInfo struct {
	Program struct {
		Type      SupportedLanguages `json:"type" db:"type"`
		CustomExe string             `json:"customExe" db:"customExe"`
	} `json:"program" db:"program"`
}

type FilePanelInfo struct {
	File struct {
		ContentTypeInfo ContentTypeInfo `json:"contentTypeInfo" db:"contentTypeInfo"`
		Name            string          `json:"name" db:"name"`
	} `json:"file" db:"file"`
}

type LiteralPanelInfoLiteral struct {
	ContentTypeInfo ContentTypeInfo `json:"contentTypeInfo" db:"contentTypeInfo"`
}

type LiteralPanelInfo struct {
	Literal LiteralPanelInfoLiteral `json:"literal" db:"literal"`
}

type HttpPanelInfo struct {
	Http HttpConnectorInfo `json:"http" db:"http"`
}

type TimeSeriesRelativeTimes string

const (
	Last5Minutes  TimeSeriesRelativeTimes = "last-5-minutes"
	Last15Minutes TimeSeriesRelativeTimes = "last-15-minutes"
	Last30Minutes TimeSeriesRelativeTimes = "last-30-minutes"
	LastHour      TimeSeriesRelativeTimes = "last-hour"
	Last3Hours    TimeSeriesRelativeTimes = "last-3-hours"
	Last6Hours    TimeSeriesRelativeTimes = "last-6-hours"
	Last12Hours   TimeSeriesRelativeTimes = "last-12-hours"
	LastDay       TimeSeriesRelativeTimes = "last-day"
	Last3Days     TimeSeriesRelativeTimes = "last-3-days"
	LastWeek      TimeSeriesRelativeTimes = "last-week"
	Last2Weeks    TimeSeriesRelativeTimes = "last-2-weeks"
	LastMonth     TimeSeriesRelativeTimes = "last-month"
	Last2Months   TimeSeriesRelativeTimes = "last-2-months"
	Last3Months   TimeSeriesRelativeTimes = "last-3-months"
	Last6Months   TimeSeriesRelativeTimes = "last-6-months"
	LastYear      TimeSeriesRelativeTimes = "last-year"
	Last2Years    TimeSeriesRelativeTimes = "last-2-years"
	AllTime       TimeSeriesRelativeTimes = "all-time"
)

type TimeSeriesFixedTimes string

const (
	ThisHour        = "this-hour"
	PreviousHour    = "previous-hour"
	Today           = "today"
	Yesterday       = "yesterday"
	WeekToDate      = "week-todate"
	PreviousWeek    = "previous-week"
	MonthToDate     = "month-to-date"
	PreviousMonth   = "previous-month"
	QuarterToDate   = "quarter-to-date"
	PreviousQuarter = "previous-quarter"
	YearToDate      = "year-to-date"
	PreviousYear    = "previous-year"
)

type TimeSeriesRangeType string

const (
	AbsoluteRange TimeSeriesRangeType = "absolute"
	RelativeRange TimeSeriesRangeType = "relative"
	FixedRange    TimeSeriesRangeType = "fixed"
	None          TimeSeriesRangeType = "none"
)

type TimeSeriesRange struct {
	Field     string                   `json:"field"`
	SortOn    *string                  `json:"sortOn"`
	SortAsc   *bool                    `json:"sortAsc"`
	Type      TimeSeriesRangeType      `json:"rangeType"`
	BeginDate *time.Time               `json:"begin_date"`
	EndDate   *time.Time               `json:"end_date"`
	Relative  *TimeSeriesRelativeTimes `json:"relative"`
	Fixed     *TimeSeriesFixedTimes    `json:"fixed"`
}

type AggregateType string

const (
	NoneAggregate    AggregateType = "none"
	CountAggregate   AggregateType = "count"
	SumAggregate     AggregateType = "sum"
	AverageAggregate AggregateType = "average"
	MinAggregate     AggregateType = "min"
	MaxAggregate     AggregateType = "max"
)

type FilaggPanelInfoFilagg struct {
	PanelSource    any             `json:"panelSource"`
	Filter         string          `json:"filter"`
	Range          TimeSeriesRange `json:"range"`
	AggregateType  AggregateType   `json:"aggregateType"`
	GroupBy        string          `json:"groupBy"`
	AggregateOn    string          `json:"aggregateOn"`
	SortOn         string          `json:"sortOn"`
	SortAsc        bool            `json:"sortAsc"`
	WindowInterval string          `json:"windowInterval"`
	Limit          int             `json:"limit"`
}

func (fpif FilaggPanelInfoFilagg) GetPanelSource() string {
	if s, ok := fpif.PanelSource.(string); ok {
		return s
	}

	return fmt.Sprintf("%v", fpif.PanelSource)
}

type FilaggPanelInfo struct {
	Filagg FilaggPanelInfoFilagg `json:"filagg"`
}

type DatabasePanelInfoDatabase struct {
	ConnectorId string            `json:"connectorId" db:"connectorId"`
	Range       TimeSeriesRange   `json:"range" db:"range"`
	Table       string            `json:"table" db:"table"`
	Step        float64           `json:"step" db:"step"`
	Extra       map[string]string `json:"extra" db:"extra"`
}

type DatabasePanelInfo struct {
	Database DatabasePanelInfoDatabase `json:"database" db:"database"`
}

type GraphPanelInfoGraph struct {
	PanelSource string        `json:"panelSource" db:"panelSource"`
	Ys          []TableColumn `json:"ys" db:"ys"`
	X           string        `json:"x" db:"x"`
}

type GraphPanelInfo struct {
	Graph GraphPanelInfoGraph `json:"graph" db:"graph"`
}

type TableColumn struct {
	Field string `json:"field"`
	Label string `json:"label"`
}

type TablePanelInfoTable struct {
	Columns     []TableColumn `json:"columns" db:"columns"`
	PanelSource string        `json:"panelSource" db:"panelSource"`
	RowNumbers  bool          `json:"rowNumbers"`
}

type TablePanelInfo struct {
	Table TablePanelInfoTable `json:"table" db:"table"`
}

type ConnectorInfoType string

const (
	DatabaseConnector ConnectorInfoType = "database"
	HTTPConnector     ConnectorInfoType = "http"
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
	MySQLDatabase         DatabaseConnectorInfoType = "mysql"
	SQLiteDatabase        DatabaseConnectorInfoType = "sqlite"
	OracleDatabase        DatabaseConnectorInfoType = "oracle"
	SQLServerDatabase     DatabaseConnectorInfoType = "sqlserver"
	PrestoDatabase        DatabaseConnectorInfoType = "presto"
	ClickHouseDatabase    DatabaseConnectorInfoType = "clickhouse"
	SnowflakeDatabase     DatabaseConnectorInfoType = "snowflake"
	CassandraDatabase     DatabaseConnectorInfoType = "cassandra"
	ScyllaDatabase        DatabaseConnectorInfoType = "scylla"
	ElasticsearchDatabase DatabaseConnectorInfoType = "elasticsearch"
	SplunkDatabase        DatabaseConnectorInfoType = "splunk"
	PrometheusDatabase    DatabaseConnectorInfoType = "prometheus"
	InfluxDatabase        DatabaseConnectorInfoType = "influx"
	InfluxFluxDatabase    DatabaseConnectorInfoType = "influx-flux"
	CockroachDatabase     DatabaseConnectorInfoType = "cockroach"
	TimescaleDatabase     DatabaseConnectorInfoType = "timescale"
	CrateDatabase         DatabaseConnectorInfoType = "crate"
	YugabyteDatabase      DatabaseConnectorInfoType = "yugabyte"
	QuestDatabase         DatabaseConnectorInfoType = "quest"
	BigQueryDatabase      DatabaseConnectorInfoType = "bigquery"
	MongoDatabase         DatabaseConnectorInfoType = "mongo"
	AthenaDatabase        DatabaseConnectorInfoType = "athena"
	AirtableDatabase      DatabaseConnectorInfoType = "airtable"
	GoogleSheetsDatabase  DatabaseConnectorInfoType = "google-sheets"
	Neo4jDatabase         DatabaseConnectorInfoType = "neo4j"
	ODBCDatabase          DatabaseConnectorInfoType = "odbc"
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

type HttpConnectorInfoHeader struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type HttpConnectorInfoHttp struct {
	Method          string                    `json:"method" db:"method"`
	Url             string                    `json:"url" db:"url"`
	ContentTypeInfo ContentTypeInfo           `json:"contentTypeInfo" db:"contentTypeInfo"`
	AllowInsecure   bool                      `json:"allowInsecure" db:"allowInsecure"`
	Headers         []HttpConnectorInfoHeader `json:"headers" db:"headers"`
}

type HttpConnectorInfo struct {
	Http HttpConnectorInfoHttp `json:"http" db:"http"`
}

type ProjectPage struct {
	Panels        []PanelInfo `json:"panels" db:"panels"`
	Schedules     []any       `json:"schedules" db:"schedules"`
	Name          string      `json:"name" db:"name"`
	Id            string      `json:"id" db:"id"`
	RefreshPeriod int         `json:"refreshPeriod" db:"refreshPeriod"`
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

type CacheSettings struct {
	CachePresent bool
	Enabled      bool
}

var DefaultCacheSettings = &CacheSettings{} // Bools are set to false by default.
