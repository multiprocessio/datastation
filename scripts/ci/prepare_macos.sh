#!/usr/bin/env bash

/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install cmake jq
sudo julia -e 'Pkg.add("JSON.jl")'
sudo Rscript -e 'install.packages("rjson", repos="https://cloud.r-project.org")'
npm install --global yarn
yarn
