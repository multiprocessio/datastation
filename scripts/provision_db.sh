#!/usr/bin/env bash

set -eu

# Usage: ./scripts/provision_db.sh $new_password
sudo su postgres bash -c "psql -c $'CREATE USER datastation WITH PASSWORD \'$1\';'"
sudo su postgres bash -c "psql -c 'CREATE DATABASE datastation WITH OWNER datastation;'"
