#!/usr/bin/env bash

set -eux

# Build once up front
yarn build-ui

# Now watch for changes in the background and rebuild
fswatch -x --event Created --event Removed --event Renamed --event Updated ./ui ./shared | grep --line-buffered -E "\\.(tsx|css|ts|js|jsx)" | xargs -n1 bash -c 'yarn esbuild ui/app.tsx --loader:.ts=tsx --loader:.js=jsx --bundle --sourcemap --outfile=build/ui.js && cp ui/style.css build/style.css' &

# Serve the pages
python3 -m http.server --directory build 8080
