#!/usr/bin/env bash

set -e

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"

sudo mkdir -p /etc/datastation /usr/share/datastation/
sudo cp -r "$SCRIPT_DIR/*" /usr/share/datastation
sudo cp "$SCRIPT_DIR/config.json" /etc/datastation/
sudo cp "$SCRIPT_DIR/datastation.service" /etc/systemd/system/
sudo cp "$SCRIPT_DIR/datastation-exporter.timer" /etc/systemd/system/

sudo id -u datastation >/dev/null 2>&1 || sudo useradd -r -s /bin/false datastation
sudo chown -R datastation:datastation /etc/datastation /usr/share/datastation
