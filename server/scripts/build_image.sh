#!/usr/bin/env bash

set -eu

image=$(docker build . --quiet -f Dockerfile.build -t datastation-builder)
docker run -v $(pwd):/datastation "$image" yarn build-server
