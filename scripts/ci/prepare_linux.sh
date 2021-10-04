#!/usr/bin/env bash

set -eux

# Set up Node.js, databases
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get update -y
sudo apt-get install -y nodejs cmake xvfb jq postgresql postgresql-server postgresql-contrib mysql-server clickhouse

# Set up R
#sudo apt-get install -y dirmngr gnupg apt-transport-https ca-certificates software-properties-common build-essential
#wget -qO- https://cloud.r-project.org/bin/linux/ubuntu/marutter_pubkey.asc | sudo tee -a /etc/apt/trusted.gpg.d/cran_ubuntu_key.asc
#sudo add-apt-repository "deb https://cloud.r-project.org/bin/linux/ubuntu $(lsb_release -cs)-cran40/"
#sudo apt-get update -y
#sudo apt install r-base

# Allow R programs to install packages
sudo mkdir -P /usr/local/lib/R/site-library
sudo chown -R $USER:$GROUP /usr/local/lib/R/

# # Set up MySQL
sudo mysql -u root --execute="CREATE USER 'test'@'localhost' IDENTIFIED BY 'test'";
sudo mysql -u root --execute="CREATE DATABASE test";
sudo mysql -u root --execute="GRANT ALL ON *.* TO 'test'@'localhost' IDENTIFIED BY 'test'";

# # Set up PostgreSQL
sudo /usr/bin/postgresql-setup --initdb
sudo psql -U postgres -c "CREATE USER test WITH PASSWORD 'test'"
sudo psql -U postgres -c "CREATE DATABASE test"
sudo psql -U postgres -c "GRANT ALL ON test TO test"

# # Set up ClickHouse
# sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv E0C56BD4
# echo "deb https://repo.clickhouse.tech/deb/stable/ main/" | sudo tee /etc/apt/sources.list.d/clickhouse.list
# sudo apt-get update -y
# sudo apt-get install -y clickhouse-server clickhouse-client
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
# sudo clickhouse-server start

# Set up project
sudo npm install --global yarn
yarn
