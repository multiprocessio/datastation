#!/usr/bin/env bash

/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install cmake jq
julia -e 'Pkg.add("JSON.jl")'
Rscript -e 'install.packages("rjson", repos="https://cloud.r-project.org")'
npm install --global yarn
yarn
