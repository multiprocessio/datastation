#!/usr/bin/env bash

mkdir -p certs
openssl req -newkey rsa:2048 -nodes -keyout certs/key.pem -x509 -days 3650 -out certs/cert.pem
