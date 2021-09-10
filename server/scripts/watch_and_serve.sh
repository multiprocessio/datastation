#!/usr/bin/env bash

set -eux

# Kill all xargs/fswatch children on exit
trap 'killall xargs' SIGINT SIGTERM EXIT

export UI_CONFIG_OVERRIDES="window.DS_CONFIG_SERVER_ROOT = 'http://localhost:8080';"

# Build once up front
yarn build-ui
yarn build-server

server_pid=""
function restart_server() {
    kill $server_pid || echo "No server running"
    node ./build/server.js
    server_pid=$?
}

# Now watch for changes in the background and rebuild
function watch() {
    for dir in $(find "$1" -type d); do
	fswatch -x --event Created --event Removed --event Renamed --event Updated "$dir" | grep --line-buffered -E "\\.(tsx|css|ts|js|jsx)" | xargs -n1 exec "$2" &
    done
}

watch ./ui "yarn build-ui"
watch ./shared "yarn build-ui && yarn build-server"
watch ./desktop "yarn build-server && restart_server"
watch ./server "yarn build-server && restart_server"

restart_server
