#!/usr/bin/env bash

for commit in $(git --no-pager log --reverse --pretty=format:"%h"); do
    if [[ -z $(git ls-tree -r "$commit" --name-only | grep "$1") ]]; then
	continue
    fi

    f="$(git show $commit:"$1" | grep "$2")"
    if ! [[ -z "$f" ]] ; then
	git blame "$commit" -- "$1" | grep "$2"
	exit 0
    fi
done

exit 1
