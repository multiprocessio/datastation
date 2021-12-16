#!/usr/bin/env bash

set -eux

/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew uninstall go@1.15
brew install cmake jq go r julia
npm install --global yarn
yarn
