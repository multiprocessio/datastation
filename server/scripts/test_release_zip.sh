#!/usr/bin/env bash

set -e

docker build . -f ./server/scripts/test_systemd_dockerfile -t fedora-systemd
cid=$(docker run -d fedora-systemd:latest)
docker cp ./releases/$1 $cid:/

function c_run() {
    docker exec $cid bash -c "$1"
}

c_run "unzip /$1"
c_run "/datastation/release/install.sh"
c_run "truncate --size 0 /etc/datastation/config.yaml"
c_run "systemctl restart datastation"

# Wait for server to start
sleep 10

result="$(c_run 'curl localhost:8080')"

expected=<<EOF
<title>DataStation Server CE</title>

<meta name="viewport" content="width=device-width, initial-scale=1">



<link rel="stylesheet" type="text/css" href="/style.css" />

<div id="root">
  <div class="loading">Loading...</div>
</div>

<script src="/ui.js"></script>
EOF

if diff -wB <(echo "$expected") <(echo "$result"); then
    echo "Unexpected response body:"
    echo "$result"
    exit 1
fi
