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
