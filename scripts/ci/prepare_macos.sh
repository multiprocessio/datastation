#!/usr/bin/env bash

set -eux

/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew uninstall go@1.15
brew install cmake jq go@1.18 r julia node@16 npm
brew link --overwrite node@16
go install github.com/google/go-jsonnet/cmd/jsonnet@latest
go install github.com/multiprocessio/httpmirror@latest
cp ~/go/bin/httpmirror /usr/local/bin/httpmirror
npm install --global yarn
yarn
