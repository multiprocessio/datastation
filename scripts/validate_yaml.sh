#!/usr/bin/env bash

set -eu

failed=0

for yamlfile in $(git ls-files | grep '.yml\|.yaml'); do
    if ! $(ruby -ryaml -e "YAML.load(STDIN.read)" < $yamlfile); then
	printf "\n\nIn $yamlfile\n\n"
	failed=1
    fi
done

exit "$failed"
