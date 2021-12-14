package main

import (
	"path"

	"github.com/google/uuid"
)

type LanguageSettings struct {
	Path string `json:"path"`
}

type Theme string

const (
	LightTheme Theme = "light"
	DarkTheme        = "dark"
)

type Settings struct {
	Id            string                                  `json:"id"`
	LastProject   *string                                 `json:"lastProject"`
	Languages     map[SupportedLanguages]LanguageSettings `json:"languages"`
	File          string                                  `json:"file"`
	StdoutMaxSize int                                     `json:"stdoutMaxSize"`
	Theme         Theme                                   `json:"theme"`
}

var defaultSettingsFile = path.Join(FS_BASE, ".settings")

var defaultSettings = &Settings{
	Id:            uuid.New().String(),
	File:          path.Join(defaultSettingsFile),
	StdoutMaxSize: 5000,
	Theme:         "light",
}

func loadSettings() (*Settings, error) {
	var settings Settings
	err := readJSONFileInto(defaultSettingsFile, &settings)
	return &settings, err
}
