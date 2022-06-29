#!/usr/bin/env bash

set -ex

# Download  unixODBC source code and compile
curl -LO http://www.unixodbc.org/unixODBC-2.3.11.tar.gz
tar -xvf unixODBC-2.3.11.tar.gz
cd unixODBC-2.3.11
./configure
make
sudo make install
cd .. && sudo rm -rf unixODBC-2.3.11

# Compile Go plugin
cd runner/plugins/odbc && go build -trimpath -buildmode=plugin -mod=readonly -modcacherw -ldflags="-s -w" -o ./odbc.build ./odbc.go && cd ../../..
