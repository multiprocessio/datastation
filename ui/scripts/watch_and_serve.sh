#!/usr/bin/env bash

set -eux

# Kill all xargs/fswatch children on exit
trap 'killall xargs' SIGINT SIGTERM EXIT

# Build once up front
yarn build-ui

# Now watch for changes in the background and rebuild
function watch() {
    find "$1" -type d | xargs -I {} fswatch -x --event Created --event Removed --event Renamed --event Updated "{}" | grep --line-buffered -E "\\.(tsx|css|ts|js|jsx)" | xargs -n1 bash -c 'yarn esbuild ui/app.tsx --loader:.ts=tsx --loader:.js=jsx "--external:fs" --bundle --sourcemap --outfile=build/ui.js && cp ui/style.css build/style.css' &
}

watch ./ui
watch ./shared

# Serve the pages
python3 -m http.server --directory build 8080
