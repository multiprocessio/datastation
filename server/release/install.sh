#!/usr/bin/env bash

set -ex

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)/.."

sudo mkdir -p /etc/datastation /usr/share/datastation/
sudo cp -r $ROOT_DIR/* /usr/share/datastation/
sudo cp $ROOT_DIR/release/config.yaml /etc/datastation/
sudo cp $ROOT_DIR/release/datastation.service /etc/systemd/system/
sudo cp $ROOT_DIR/release/datastation-exporter.timer /etc/systemd/system/

sudo id -u datastation >/dev/null 2>&1 || sudo useradd -r -s /bin/false datastation
sudo chown -R datastation:datastation /etc/datastation /usr/share/datastation

sudo systemctl enable datastation
