#!/usr/bin/env bash

#
# IMPORTANT: This file should only include production
# dependencies. Dependencies for integration tests should be in the
# ./prepare_linux_integration_test_setup_only.sh file in this
# directory.
#

set -ex

function retry {
    ok="false"
    for i in $(seq $1); do
	if bash -c "$2" ; then
	    ok="true"
	    break
	fi

	echo "Retrying... $2"
	sleep 5s
    done

    if [[ "$ok" == "false" ]]; then
	echo "Failed after retries... $2"
	exit 1
    fi
}

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
retry 5 yarn

race=""
if [[ "$1" == "--integration-tests" ]] || [[ "$1" == "--race" ]]; then
    race="-race"
fi

# Install ODBC
./runner/plugins/odbc/build.sh $race
