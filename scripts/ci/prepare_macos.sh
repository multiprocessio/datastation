#!/usr/bin/env bash

set -eux

/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install cmake jq node@16
brew unlink node
brew link --overwrite node@16
npm install --global yarn
yarn
