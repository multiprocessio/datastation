#!/usr/bin/env bash

set -e

cid=$(docker run -d -p 8080:8834 fedora tail -f /dev/null)
docker cp ./releases/$1 $cid:/

function c_run() {
    docker exec $cid bash -c "$1"
}

c_run "dnf install -y zip && dnf module reset nodejs && dnf module install -y nodejs:16"
c_run "unzip /$1"
c_run "/datastation/release/install.sh"
c_run "truncate /etc/datastation/config.yaml"
c_run "service datastation restart"

curl localhost:8834
