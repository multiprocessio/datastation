#!/usr/bin/env bash

set -eux

# Set up Node.js, databases
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get update -y
sudo apt-get install -y nodejs cmake xvfb jq postgresql postgresql-contrib perl-base

# Set up R
#sudo apt-get install -y dirmngr gnupg apt-transport-https ca-certificates software-properties-common build-essential
#wget -qO- https://cloud.r-project.org/bin/linux/ubuntu/marutter_pubkey.asc | sudo tee -a /etc/apt/trusted.gpg.d/cran_ubuntu_key.asc
#sudo add-apt-repository "deb https://cloud.r-project.org/bin/linux/ubuntu $(lsb_release -cs)-cran40/"
#sudo apt-get update -y
#sudo apt install r-base

# Allow R programs to install packages
sudo mkdir -p /usr/local/lib/R/site-library
sudo chown -R $USER /usr/local/lib/R/

# # Set up MySQL
sudo service mysql start
sudo mysql -u root -proot --execute="CREATE USER 'test'@'localhost' IDENTIFIED BY 'test'";
sudo mysql -u root -proot --execute="CREATE DATABASE test";
sudo mysql -u root -proot --execute="GRANT ALL PRIVILEGES ON test.* TO 'test'@'localhost'";

# # Set up PostgreSQL
echo "
local  test            test                md5
host   test            test   localhost    md5
local  all             all                 peer" | sudo tee /etc/postgresql/12/main/pg_hba.conf
sudo service postgresql restart
file psql
cat psql
sudo su postgres -- psql -c "CREATE USER test WITH PASSWORD 'test'"
sudo su postgres -- psql -c "CREATE DATABASE test"
sudo su postgres -- psql -c "GRANT ALL ON DATABASE test TO test"

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
sudo clickhouse-server start

# Set up project
sudo npm install --global yarn
yarn
