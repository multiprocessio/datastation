#!/usr/bin/env bash

set -eux

/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install cmake jq r julia node@16 npm go-jsonnet
brew link --overwrite node@16

# Install go
sudo curl -LO https://go.dev/dl/go1.18.1.darwin-amd64.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go1.18.1.darwin-amd64.tar.gz
sudo mv /usr/local/go/bin/go /usr/local/bin/go
sudo mv /usr/local/go/bin/gofmt /usr/local/bin/gofmt

# Install Go helpers
# Failing: https://github.com/google/go-jsonnet/issues/596
# go install github.com/google/go-jsonnet/cmd/jsonnet@latest
go install github.com/multiprocessio/httpmirror@latest
cp ~/go/bin/httpmirror /usr/local/bin/httpmirror

# Install JavaScript deps
npm install --global yarn
yarn

# Install ODBC Driver
brew tap microsoft/mssql-release https://github.com/Microsoft/homebrew-mssql-release
brew update
HOMEBREW_NO_ENV_FILTERING=1 ACCEPT_EULA=Y brew install msodbcsql18 mssql-tools18

# Install docker using colima (not present because of licenses)
brew install colima
brew install docker
colima start

# Run SQL server
docker run -d -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=1StrongPwd!!" --name sqlserver --hostname sqlserver -p 1433:1433 mcr.microsoft.com/mssql/server:2019-latest

# Install unixODBC
/bin/bash ./prepare_odbc.sh
