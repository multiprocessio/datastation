#!/usr/bin/env bash

set -eux

fswatch -x --event Created --event Removed --event Renamed --event Updated ./ui ./shared | grep --line-buffered -E "\\.(tsx|css|ts|js|jsx)" | xargs -n1 bash -c 'yarn esbuild ui/app.tsx --loader:.ts=tsx --loader:.js=jsx --bundle --sourcemap --outfile=build/ui.js && cp ui/style.css build/style.css' &
python3 -m http.server --directory build 8080
