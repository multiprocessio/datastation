#
# IMPORTANT! This file should only be run in integration tests.
#

#!/usr/bin/env bash

set -ex

# Set up Julia, SSH, etc.
sudo apt-get install -y jq julia openssh-server php

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

# # Set up ClickHouse
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv E0C56BD4
echo "deb https://repo.clickhouse.tech/deb/stable/ main/" | sudo tee /etc/apt/sources.list.d/clickhouse.list
sudo apt-get update -y
sudo apt-get install -y clickhouse-server clickhouse-client
sudo cp ./scripts/ci/clickhouse_users.xml /etc/clickhouse-server/users.d/test.xml
# See: https://community.atlassian.com/t5/Bitbucket-Pipelines-discussions/Broken-starting-clickhouse-in-a-docker-because-of-wrong/td-p/1689466
sudo setcap -r `which clickhouse` && echo "Cleaning caps success" || echo "Cleaning caps error"
sudo service clickhouse-server start

# Install jsonnet
go install github.com/google/go-jsonnet/cmd/jsonnet@latest
sudo ln $HOME/go/bin/jsonnet /usr/local/bin/jsonnet

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
## LAUNCH CONTAINERS

# Start up cockroach database
curl https://binaries.cockroachdb.com/cockroach-v21.2.4.linux-amd64.tgz | tar -xz && sudo cp -i cockroach-v21.2.4.linux-amd64/cockroach /usr/local/bin/
## Set up certs (see: https://www.cockroachlabs.com/docs/stable/secure-a-cluster.html)
mkdir certs cockroach-safe
cockroach cert create-ca --certs-dir=certs --ca-key=cockroach-safe/ca.key
cockroach cert create-node localhost $(hostname) --certs-dir=certs --ca-key=cockroach-safe/ca.key
cockroach cert create-client root --certs-dir=certs --ca-key=cockroach-safe/ca.key
cockroach start-single-node --certs-dir=certs --accept-sql-without-tls --background
cockroach sql --certs-dir=certs --host=localhost:26257 --execute "CREATE DATABASE test; CREATE USER test WITH PASSWORD 'test'; GRANT ALL ON DATABASE test TO test;"

# Start up elasticsearch
docker run -d -p 9200:9200 -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:7.16.3

# Start up influx (2 for fluxql)
docker run -d -p 8086:8086 -e "DOCKER_INFLUXDB_INIT_MODE=setup" -e "DOCKER_INFLUXDB_INIT_USERNAME=test" -e "DOCKER_INFLUXDB_INIT_PASSWORD=testtest" -e "DOCKER_INFLUXDB_INIT_ORG=test" -e "DOCKER_INFLUXDB_INIT_BUCKET=test" -e "DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=test" influxdb:2.0

# Start up influx (1 for influxql)
docker run -d -p 8087:8086 -e "INFLUXDB_HTTP_AUTH_ENABLED=true" -e "INFLUXDB_ADMIN_USER=test" -e "INFLUXDB_ADMIN_PASSWORD=testtest" influxdb:1.7

# Start up neo4j
neo4j="$(docker run -d -p7474:7474 -p7687:7687 --env NEO4J_AUTH=neo4j/password neo4j)"

# Start up mongodb and install mongosh (shell)
docker run -d -e "MONGO_INITDB_ROOT_USERNAME=test" -e "MONGO_INITDB_DATABASE=test" -e "MONGO_INITDB_ROOT_PASSWORD=test" -p 27017:27017 mongo:5
# curl -LO https://github.com/mongodb-js/mongosh/releases/download/v1.5.0/mongodb-mongosh_1.5.0_amd64.deb
sudo apt-get install -y mongodb-mongosh

## LOAD DATA ##

sleep 60 # Time for everything to load (influx in particular takes a while)

function retry {
    ok="false"
    for i in $(seq $1); do
	if bash -c "$2" ; then
	    ok="true"
	    break
	fi

	echo "Retrying... $2"
	sleep 5s
    done

    if [[ "$ok" == "false" ]]; then
	echo "Failed after retries... $2"
	exit 1
    fi
}

docker ps

# Load influx1 data
retry 10 'curl -XPOST "http://localhost:8087/query?u=test&p=testtest" --data-urlencode "q=CREATE DATABASE test"'
retry 10 "curl -XPOST 'http://localhost:8087/write?db=test&u=test&p=testtest' --data-binary @testdata/influx/noaa-ndbc-data-sample.lp"

# Load influx2 data
retry 10 "curl -XPOST 'http://localhost:8086/api/v2/write?org=test&bucket=test&precision=ns' --header 'Authorization: Token test' --data-binary @testdata/influx/noaa-ndbc-data-sample.lp"

# Load Elasticsearch data
retry 10 "curl -X PUT http://localhost:9200/test"
for t in $(ls testdata/documents/*.json); do
    retry 10 "curl -X POST -H 'Content-Type: application/json' -d @$t http://localhost:9200/test/_doc"
done

# Configure neo4j
docker exec "$neo4j" bin/cypher-shell -u neo4j -p password "CREATE (u:User { name : 'test' });"

# Load Mongodb documents
for t in $(ls testdata/documents/*.json); do
   mongosh "mongodb://test:test@localhost:27017" --eval "db.test.insertOne($(cat $t))"
done

# TODO: might be worth switching to docker-compose at some point...
