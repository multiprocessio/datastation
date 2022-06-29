#!/usr/bin/env bash

set -ex

# This will overwrite the non-race binary for testing
cd runner/plugins/odbc && go build -trimpath -buildmode=plugin -mod=readonly -modcacherw -ldflags="-s -w" -race -o ./odbc.build ./odbc.go && cd ../../..
