#!/usr/bin/env bash

set -ex

ROOT_DIR="$(readlink -f $(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)/..)"

sudo mkdir -p /etc/datastation /usr/share /etc/systemd/system /home/datastation
sudo cp $ROOT_DIR/release/config.yaml /etc/datastation/
sudo cp $ROOT_DIR/release/datastation.service /etc/systemd/system/
# sudo cp $ROOT_DIR/release/datastation-exporter.timer /etc/systemd/system/
sudo mv $ROOT_DIR /usr/share/datastation

sudo id -u datastation >/dev/null 2>&1 || sudo useradd -r -s /bin/false datastation
sudo chown -R datastation:datastation /etc/datastation /usr/share/datastation /home/datastation

sudo systemctl enable datastation
