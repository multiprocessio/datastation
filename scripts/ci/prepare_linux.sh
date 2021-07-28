#!/usr/bin/env bash

curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs cmake xvfb jq
sudo npm install --global yarn
yarn
