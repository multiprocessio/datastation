#!/usr/bin/env bash

set -ex

# Set up Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get update -y
sudo apt-get install -y nodejs cmake jq

# Set up Go
sudo curl -LO https://go.dev/dl/go1.17.4.linux-amd64.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go1.17.4.linux-amd64.tar.gz
sudo ln -s /usr/local/go/bin/go /usr/local/bin/go
sudo ln -s /usr/local/go/bin/gofmt /usr/local/bin/gofmt

# Set up coverage tools
go install github.com/axw/gocov/gocov@v1.0.0
go install github.com/wadey/gocovmerge@b5bfa59

if [[ "$1" == "--integration-tests" ]]; then
    # Install xvfb for headless gui
    sudo apt-get install -y xvfb

    # Allow R programs to install packages
    sudo mkdir -p /usr/local/lib/R/site-library
    sudo chown -R $USER /usr/local/lib/R/

    # # Set up MySQL
    sudo service mysql start
    sudo mysql -u root -proot --execute="CREATE USER 'test'@'localhost' IDENTIFIED BY 'test'";
    sudo mysql -u root -proot --execute="CREATE DATABASE test";
    sudo mysql -u root -proot --execute="GRANT ALL PRIVILEGES ON test.* TO 'test'@'localhost'";

    # # Set up PostgreSQL
    sudo apt-get install postgresql postgresql-contrib
    echo "
local  test            test                md5
host   test            test   localhost    md5
local  all             all                 peer" | sudo tee /etc/postgresql/12/main/pg_hba.conf
    sudo service postgresql restart
    sudo -u postgres psql -c "CREATE USER test WITH PASSWORD 'test'"
    sudo -u postgres psql -c "CREATE DATABASE test"
    sudo -u postgres psql -c "GRANT ALL ON DATABASE test TO test"

    # # Set up ClickHouse
    sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv E0C56BD4
    echo "deb https://repo.clickhouse.tech/deb/stable/ main/" | sudo tee /etc/apt/sources.list.d/clickhouse.list
    sudo apt-get update -y
    sudo apt-get install -y clickhouse-server clickhouse-client
    echo "
<yandex>
  <users>
    <test>
      <!-- test:test -->
      <password_sha256_hex>9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08</password_sha256_hex>
      <networks>
        <ip>127.0.0.1</ip>
      </networks>
      <profile>default</profile>
      <quota>default</quota>
      <access_management>1</access_management>
    </test>
  </users>
</yandex>" | sudo tee /etc/clickhouse-server/users.d/test.xml
    # See: https://community.atlassian.com/t5/Bitbucket-Pipelines-discussions/Broken-starting-clickhouse-in-a-docker-because-of-wrong/td-p/1689466
    setcap -r `which clickhouse` && echo "Cleaning caps success" || echo "Cleaning caps error"
    sudo service clickhouse-server start
fi

# Set up project
sudo npm install --global yarn
yarn
