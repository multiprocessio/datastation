#
# IMPORTANT! This file should only be run in integration tests.
#

#!/usr/bin/env bash

set -ex

# Set up SSH, etc.
sudo apt-get install -y jq openssh-server php

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

# Install julia
wget https://julialang-s3.julialang.org/bin/linux/x64/1.8/julia-1.8.5-linux-x86_64.tar.gz
tar zxvf julia-1.8.5-linux-x86_64.tar.gz
sudo ln -s $(pwd)/julia-1.8.5/bin /usr/local/bin/

# Install jsonnet
go install github.com/google/go-jsonnet/cmd/jsonnet@latest

# Set up coverage tools
go install github.com/axw/gocov/gocov@v1.0.0
go install github.com/wadey/gocovmerge@b5bfa59

# Make all go tools global
sudo ln -s $HOME/go/bin/* /usr/local/bin/

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
