#!/usr/bin/env bash

# Other than -buildmode and -ldflags, other flags must be exactly the same as for runner.
go build -trimpath -buildmode=plugin -mod=readonly -modcacherw -ldflags="-s -w" -o odbc.so odbc.go
