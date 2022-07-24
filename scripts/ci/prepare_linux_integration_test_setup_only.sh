#
# IMPORTANT! This file should only be run in integration tests.
#

#!/usr/bin/env bash

set -ex

# Set up Julia, SSH, etc.
sudo apt-get install -y jq julia openssh-server php

# Set up http helper
go install github.com/multiprocessio/httpmirror@latest

# Set up SSH keys
ssh-keygen -q -t rsa -N '' -f ~/.ssh/id_rsa <<<y >/dev/null 2>&1
cp ~/.ssh/id_rsa.pub ~/.ssh/known_hosts
cp ~/.ssh/id_rsa.pub ~/.ssh/authorized_keys

# Install Oracle client library, instructions here: https://www.oracle.com/database/technologies/instant-client/linux-x86-64-downloads.html#ic_x64_inst
curl -LO https://download.oracle.com/otn_software/linux/instantclient/instantclient-basic-linuxx64.zip
unzip instantclient-basic-linuxx64.zip

# Install xvfb for headless gui
sudo apt-get install -y xvfb

# Install deno
curl -LO https://github.com/denoland/deno/releases/download/v1.19.0/deno-x86_64-unknown-linux-gnu.zip
unzip deno-x86_64-unknown-linux-gnu.zip
chmod +x deno
sudo mv deno /usr/bin/deno

# Allow R programs to install packages
sudo mkdir -p /usr/local/lib/R/site-library
sudo chown -R $USER /usr/local/lib/R/

# Install jsonnet
go install github.com/google/go-jsonnet/cmd/jsonnet@latest
sudo ln $HOME/go/bin/jsonnet /usr/local/bin/jsonnet

# Install ODBC driver
if ! [[ "18.04 20.04 21.04" == *"$(lsb_release -rs)"* ]];
then
    echo "Ubuntu $(lsb_release -rs) is not currently supported.";
    exit;
fi

sudo curl https://packages.microsoft.com/keys/microsoft.asc | sudo apt-key add -

sudo curl https://packages.microsoft.com/config/ubuntu/$(lsb_release -rs)/prod.list -o mssql-release.list
sudo mv mssql-release.list /etc/apt/sources.list.d/mssql-release.list

sudo apt-get update
sudo ACCEPT_EULA=Y apt-get install -y msodbcsql18

# Start up mongodb and install mongosh (shell)
sudo apt-get install -y mongodb-mongosh
