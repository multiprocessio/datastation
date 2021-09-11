#!/usr/bin/env bash

set -eux

# Kill all xargs/fswatch children on exit
trap 'pkill -P $$' SIGINT SIGTERM EXIT

export UI_CONFIG_OVERRIDES="window.DS_CONFIG_SERVER_ROOT = 'http://localhost:8080';"
export SERVER_CONFIG_OVERRIDES="global.DS_CONFIG_SERVER_ROOT = 'http://localhost:8080';"

# Build once up front
yarn build-ui
yarn build-server

# Now watch for changes in the background and rebuild
function watch() {
    for dir in $(find "$1" -type d); do
	(fswatch -x --event Created --event Removed --event Renamed --event Updated "$dir" | grep --line-buffered -E "\\.(tsx|css|ts|js|jsx)" | xargs -n1 bash -c "$2") &
    done
}

watch ./ui "yarn build-ui"
watch ./shared "yarn build-ui && yarn build-server"
watch ./desktop "yarn build-server"
watch ./server "yarn build-server"

node ./build/server.js
