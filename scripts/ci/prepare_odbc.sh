#!/usr/bin/env bash

# Download source code and compile
curl -LO http://www.unixodbc.org/unixODBC-2.3.11.tar.gz
tar -xvf unixODBC-2.3.11.tar.gz
cd unixODBC-2.3.11
./configure
make
sudo make install
cd .. && sudo rm -rf unixODBC-2.3.11

# Build Go plugin
cd runner/plugins/odbc
/bin/bash ./build.sh
cd ../../..
