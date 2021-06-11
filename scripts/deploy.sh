#!/usr/bin/env bash

set -eux

REMOTE=fedora@datastation.multiprocess.io
REMOTE_HOME=/home/fedora

function remote_copy () {
    scp -i ~/.ssh/id_rsa -r $1 $REMOTE:$2
}

function remote_run () {
    ssh $REMOTE -- "$1"
}

remote_run "rm -rf $REMOTE_HOME/ui"
remote_copy build $REMOTE_HOME/ui
remote_copy config/nginx.conf $REMOTE_HOME/nginx.conf
remote_copy config/selinux.conf $REMOTE_HOME/selinux.conf
remote_run "sudo dnf install -y nginx && sudo mkdir -p /run && sudo mkdir -p /usr/share/nginx/logs && sudo mv $REMOTE_HOME/nginx.conf /etc/nginx && sudo nginx -t && sudo setenforce permissive && sudo service nginx restart && sudo mv $REMOTE_HOME/selinux.conf /etc/selinux/config"
