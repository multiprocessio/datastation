package main

import (
	"github.com/google/uuid"
)

type PanelResult struct {
	Exception   *string        `json:"exception"`
	Value       *[]interface{} `json:"value"`
	Preview     string         `json:"preview"`
	Stdout      string         `json:"stdout"`
	Shape       Shape          `json:"shape"`
	ArrayCount  *number        `json:"number"`
	Size        number         `json:"size"`
	ContentType string         `json:"contentType"`
	Elapsed     *number        `json:"elapsed"`
}

var defaultPanelResult = PanelResult{
	Stdout:      "",
	Shape:       defaultShape,
	Preview:     "",
	Size:        0,
	ContentType: "unknown",
	Elapsed:     0,
	Value:       null,
	Exception:   null,
	ArrayCount:  null,
}

type Encrypt struct {
	Value     string `json:"value"`
	Encrypted bool   `json:"encrypted"`
}

type ServerInfoType string

const (
	SSHAgent      = "ssh-agent"
	SSHPassword   = "password"
	SSHPrivateKey = "private-key"
)

type ServerInfo struct {
	Name               string         `json:"name"`
	Address            string         `json:"address"`
	Port               number         `json:"port"`
	Type               ServerInfoType `json:"type"`
	Username           string         `json:"username"`
	Password_encrypt   Encrypt        `json:"password_encrypt"`
	PrivateKeyFile     string         `json:"privateKeyFile"`
	Passphrase_encrypt Encrypt        `json:"passphrase_encrypt"`
	Id                 string         `json:"id"`
}

var defaultServerInfo = ServerInfo{
	Type:               SSHPrivateKey,
	Name:               "Untitled Server",
	Address:            "",
	Port:               22,
	Username:           "",
	Password_encrypt:   Encrypt{},
	PrivateKeyFile:     "~/.ssh/id_rsa",
	Passphrase_encrypt: Encrypt{},
	Id:                 uuid.New().String(),
}

type ConnectorInfoType string

const (
	ConnectorDatabase = "database"
	ConnectorHttp     = "http"
)

type ConnectorInfo struct {
	Name     string            `json:"name"`
	Type     ConnectorInfoType `json:"type"`
	Id       string            `json:"id"`
	ServerId *string           `json:"serverId"`
}

var defaultConnectorInfo = ConnectorInfo{
	Name:     "Untitled Connector",
	Type:     ConnectorDatabase,
	ServerId: "",
	Id:       uuid.New().String(),
}

type HTTPConnectorInfoMethod string

const (
	HTTPGet    = "GET"
	HTTPHead   = "HEAD"
	HTTPPut    = "PUT"
	HTTPPost   = "POST"
	HTTPDelete = "DELETE"
)

type ContentTypeInfo struct {
	Type             string `json:"type"`
	CustomLineRegexp string `json:"customLineRegexp"`
}

var defaultContentTypeInfo = ContentTypeInfo{}

type HTTPConnectorInfo struct {
	ConnectorInfo
	HTTP struct {
		Headers []struct {
			Value string `json:"value"`
			Name  string `json:"name"`
		} `json:"headers"`
		Url             string                  `json:"url"`
		Method          HTTPConnectorInfoMethod `json:"method"`
		ContentTypeInfo ContentTypeInfo         `json:"contentTypeInfo"`
	} `json:"http"`
}

var defaultHTTPConnectorInfo = HTTPConnectorInfo{
	ConnectorInfo{
		Name:     "Untitled HTTP Connector",
		Id:       uuid.New().String(),
		Type:     ConnectorHttp,
		ServerId: "",
	},
	Headers:         nil,
	Method:          HTTPGet,
	ContentTypeInfo: defaultContentTypeInfo,
}

type PanelInfoType string

const (
	HttpPanel    = "http"
	ProgramPanel = "program"
	LiteralPanel = "literal"
	FilePanel    = "file"
	FilaggPanel  = "filagg"
)

type PanelInfo struct {
	Content    string        `json:"content"`
	Type       PanelInfoType `json:"type"`
	Name       string        `json:"name"`
	Id         string        `json:"id"`
	ServerId   string        `json:"serverId"`
	ResultMeta PanelResult   `json:"resultMeta"`
	*ProgramPanelInfo
	*FilePanelInfo
	*LiteralPanelInfo
}

type ProgramPanelInfo struct {
	Program struct {
		Type SupportedLanguages `json:"type"`
	} `json:"program"`
}

type FilePanelInfo struct {
	File struct {
		ContentTypeInfo ContentTypeInfo `json:"contentInfoType"`
		Name            string          `json:"name"`
	} `json:"file"`
}

type LiteralPanelInfo struct {
	Literal struct {
		ContentTypeInfo ContentTypeInfo `json:"contentInfoType"`
	} `json:"literal"`
}

type ProjectPage struct {
	Panels    []PanelInfo `json:"panels"`
	Schedules []Scheduled `json:"schedules"`
	Name      string      `json:"name"`
	Id        string      `json:"id"`
}

type ProjectState struct {
	Pages           []ProjectPage `json:"pages"`
	ProjectName     string        `json:"projectName"`
	Id              string        `json:"id"`
	OriginalVersion string        `json:"originalVersion"`
	LastVersion     string        `json:"lastVersion"`
}
