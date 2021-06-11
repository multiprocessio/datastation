#!/usr/bin/env bash

set -eux

if [[ "$(git diff)" != "" ]]; then
    echo "Unexpected diff"
    git diff
    exit 1
fi
