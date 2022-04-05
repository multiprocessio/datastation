#!/usr/bin/env bash

set -e

code="0"
for f in $(git ls-files); do
    if [[ "$f" == *".json" ]] || [[ "$f" == *".lock" ]] || [[ "$f" == *"ignore" ]] || [[ "$f" == ".eslintrc" ]]; then
	continue
    fi

    if ! [[ "$(cat $f)" == *"Copyright 2022 Multiprocess Labs LLC"* ]]; then
	echo "$f"
	code="1"
    fi
done

exit "$code"
