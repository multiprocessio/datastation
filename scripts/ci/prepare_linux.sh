#!/usr/bin/env bash

#
# IMPORTANT: This file should only include production
# dependencies. Dependencies for integration tests should be in the
# ./prepare_linux_integration_test_setup_only.sh file in this
# directory.
#

set -ex

# Set up Node.js, jq
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get update -y
sudo apt-get install -y nodejs cmake

# Set up Go
./scripts/ci/prepare_go.sh
#
# IMPORTANT: Only run in Github CI.
#
if [[ "$1" == "--integration-tests" ]]; then
    ./scripts/ci/prepare_linux_integration_test_setup_only.sh
fi

# Set up project
sudo npm install --global yarn
yarn

# Install unixODBC and build Go plugin
/bin/bash ./scripts/ci/prepare_odbc.sh
