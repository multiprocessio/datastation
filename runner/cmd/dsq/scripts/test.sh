#!/usr/bin/env bash

set -ex

types="csv parquet json"

for t in $types; do
    echo "Testing $t (file)."
    ls -lah ./testdata/userdata.$t
    sqlcount="$(./dsq -v ./testdata/userdata.$t 'SELECT COUNT(1) AS c FROM {}' | jq '.[0].c')"
    if [[ "$sqlcount" != "1000" ]]; then
	echo "Bad SQL count for $t (file). Expected 1000, got $sqlcount."
	exit 1
    else
	echo "File $t test successful."
    fi

    echo "Testing $t (pipe)."
    sqlcount="$(cat ./testdata/userdata.$t | ./dsq $t 'SELECT COUNT(1) AS c FROM {}' | jq '.[0].c')"
    if [[ "$sqlcount" != "1000" ]]; then
	echo "Bad SQL count for $t (pipe). Expected 1000, got $sqlcount."
	exit 1
    else
	echo "Pipe $t test successful."
    fi
done
