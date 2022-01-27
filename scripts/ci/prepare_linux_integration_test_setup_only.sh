#
# IMPORTANT! This file should only be run in integration tests.
#

#!/usr/bin/env bash

set -ex

# Set up Julia, SSH, etc.
sudo apt-get install -y jq julia openssh-server php

# Set up coverage tools
go install github.com/axw/gocov/gocov@v1.0.0
go install github.com/wadey/gocovmerge@b5bfa59
sudo ln -s $HOME/go/bin/* /usr/local/bin/

# Set up SSH keys
ssh-keygen -q -t rsa -N '' -f ~/.ssh/id_rsa <<<y >/dev/null 2>&1
cp ~/.ssh/id_rsa.pub ~/.ssh/known_hosts
cp ~/.ssh/id_rsa.pub ~/.ssh/authorized_keys

# Install Oracle client library, instructions here: https://www.oracle.com/database/technologies/instant-client/linux-x86-64-downloads.html#ic_x64_inst
curl -LO https://download.oracle.com/otn_software/linux/instantclient/instantclient-basic-linuxx64.zip
unzip instantclient-basic-linuxx64.zip

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

# Install jsonnet
go install github.com/google/go-jsonnet/cmd/jsonnet@latest
sudo ln $HOME/go/bin/jsonnet /usr/local/bin/jsonnet

# Start up sqlserver
docker run -d -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=1StrongPwd!!" -p 1433:1433 mcr.microsoft.com/mssql/server:2019-latest

# Start up oracle database
docker run -d -e ORACLE_RANDOM_PASSWORD="y" -e "APP_USER=test" -e "APP_USER_PASSWORD=test" -p 1521:1521 gvenzl/oracle-xe:latest

# Start up cockroach database
curl https://binaries.cockroachdb.com/cockroach-v21.2.4.linux-amd64.tgz | tar -xz && sudo cp -i cockroach-v21.2.4.linux-amd64/cockroach /usr/local/bin/
cockroach start-single-node --accept-sql-without-tls --background
cockroach sql --execute "CREATE DATABASE test; CREATE USER test WITH PASSWORD 'test'; GRANT ALL ON DATABASE test TO test;"

# Start up cratedb
id="$(docker run -d -p 5432:5434 crate -Cdiscovery.type=single-node)"
docker exec -it "$id" crash -c "CREATE DATABASE test; CREATE USER test WITH (password = 'test'); GRANT ALL PRIVILEGES TO test;"

# Start up questdb
docker run -d -p 8812:8812 questdb/questdb

# Start up elasticsearch
docker run -d -p 9200:9200 -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:7.16.3

# Start up prometheus
docker run -d -p 9090:9090 prom/prometheus

# Start up influx (2 for fluxql)
docker run -d -p 8086:8086 -e "DOCKER_INFLUXDB_INIT_MODE=setup" -e "DOCKER_INFLUXDB_INIT_USERNAME=test" -e "DOCKER_INFLUXDB_INIT_PASSWORD=test" -e "DOCKER_INFLUXDB_INIT_ORG=test" -e "DOCKER_INFLUXDB_INIT_BUCKET=test" -e "DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=test" influxdb:2.0

# Start up influx (1 for influxql)
docker run -d -p 8086:8087 -e "INFLUXDB_HTTP_AUTH_ENABLED=true" -e "INFLUXDB_ADMIN_USER=test" -e "INFLUXDB_ADMIN_PASSWORD=test" influxdb:1.7

# Start up scylla
docker run -d scylladb/scylla --smp 1 --authenticator PasswordAuthenticator

# TODO: might be worth switching to docker-compose at some point...
