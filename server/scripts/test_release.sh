#!/usr/bin/env bash

set -e

function docker() {
    podman "$@"
}

cp ./releases/$1 ./releases/datastation-docker-release-test.tar.gz
docker build . -q -f ./server/scripts/test_systemd_dockerfile -t datastation-server-test
cid=$(docker run -d datastation-server-test:latest)

debug() {
    rv=$?
    if ! [[ "$rv" == "0" ]]; then
	docker ps -a
	docker logs $cid
	docker rm -f $cid || echo "Container already exited."
    fi
    exit $rv
}
trap "debug" exit

function c_run() {
    docker exec $cid bash -c "$1"
}

# TODO: test out systemd settings eventually
# # Copy in zip file
# docker cp ./releases/$1 $cid:/
# 
# c_run "tar xvzf /$1"
# c_run "/datastation/release/install.sh"
# c_run "truncate --size 0 /etc/datastation/config.yaml"
# c_run "systemctl restart datastation"

# Wait for server to start
sleep 10

result="$(c_run 'curl localhost:8080')"

expected='<title>DataStation Server CE</title>

<meta name="viewport" content="width=device-width, initial-scale=1">



<link rel="stylesheet" type="text/css" href="/style.css" />

<div id="root">
  <div class="loading">Loading...</div>
</div>

<script src="/ui.js"></script>'

if ! diff -u -wB <(echo "$expected") <(echo "$result"); then
    echo "Unexpected response body:"
    echo "$result"
    exit 1
fi


echo "Looks ok!"
exit 0
