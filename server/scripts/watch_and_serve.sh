#!/usr/bin/env bash

set -eux

# Kill all xargs/fswatch children on exit
trap 'pkill -P $$' SIGINT SIGTERM EXIT

# Build once up front
yarn build-server

# Now watch for changes in the background and rebuild
function watch() {
    for dir in $(find "$1" -type d); do
	(fswatch -x --event Created --event Removed --event Renamed --event Updated "$dir" | grep --line-buffered -E "\\.(tsx|css|ts|js|jsx)" | xargs -n1 yarn build-server) &
    done
}

watch ./ui
watch ./shared
watch ./desktop
watch ./server

node ./build/server.js
