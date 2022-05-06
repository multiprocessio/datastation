#!/usr/bin/env bash

set -e

docker build . -f ./server/scripts/test_systemd_dockerfile -t fedora-systemd
cid=$(docker run -d -p 8834:8080 fedora-systemd:latest)
docker cp ./releases/$1 $cid:/

function c_run() {
    docker exec $cid bash -c "$1"
}

c_run "unzip /$1"
c_run "/datastation/release/install.sh"
c_run "truncate --size 0 /etc/datastation/config.yaml"
c_run "service datastation restart"

curl localhost:8834
