#!/usr/bin/env bash

set -eux

# Kill all xargs/fswatch children on exit
trap 'killall xargs' SIGINT SIGTERM EXIT

# Build once up front
yarn build-ui

# Now watch for changes in the background and rebuild
function watch() {
    for dir in $(find "$1" -type d); do
	fswatch -x --event Created --event Removed --event Renamed --event Updated "$dir" | grep --line-buffered -E "\.(tsx|css|ts|js|jsx)" | xargs -n1 bash -c 'yarn esbuild ui/index.tsx --loader:.ts=tsx --loader:.js=jsx "--external:fs" --bundle --sourcemap --outfile=build/ui.js && cp ui/style.css build/style.css' &
    done
}

watch ./ui
watch ./shared

# Serve the pages
python3 -m http.server --directory build 8080
