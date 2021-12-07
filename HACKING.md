# Hacking

You'll need a recent Node.js, Python3, cmake, and
[yarn](https://yarnpkg.com/).

You'll also need a C++ compiler for some native Node.js
packages. Install MSVC++ (Visual Studio) on Windows or XCode on
macOS. On Linux install gcc or clang.

You'll need Go 1.17 or newer.

If you want to have hot-reloading, install
[fswatch](https://github.com/emcrisostomo/fswatch).

## Principles

* Keep things simple and don't abstract early
* Node packages bring in tons of dependencies. So be very careful before adding new depencies and don't bring in small dependencies or dependencies that can be easily written and fully unit-tested.
* Keep adding unit tests and bumping 

## Build and run the online environment

This will start a web server for the in-browser application. If you
have fswatch it will also build the UI:

```
yarn start-ui
```

If you don't have fswatch or want to manually trigger a build of the UI app, run this:

```
yarn build-ui
```

And manually start a web-server: `python3 -m http.server --port 8080 build`.

### Via Docker

To build and run the in-browser application via `docker` and `docker-compose`:

```
docker-compose -f docker-compose-browser.yml build
docker-compose -f docker-compose-browser.yml up
```

## Build and run the desktop app

```
yarn start-desktop
```

## Formatting, type-checking

```
yarn format
```

```
yarn tsc
```

### Building a desktop release

This needs to be done on each supported platform. For Windows, macOS, and Linux it is handled by Github Actions.

```
yarn release-desktop $version
```

## Build and run the server app

You'll need to have PostgreSQL install and running. Create a
`datastation` database and user. Or run `./scripts/provision_db.sh`.

Then run migrations: `psql -U datastation -f
./server/migrations/1_init.sql`.

Create a config file at `/etc/datastation/config.json` and
fill out the following fields:

```
{
  "auth": {
    "sessionSecret": "", // Any strong random string for signing sessions
    "openId": {
      "realm": "https://accounts.google.com", // Or some other realm
      "clientId": "my id",
      "clientSecret": "my secret"
    }
  },

  "server": {
    "port": 443,
    "address": "localhost",
    "publicUrl": "https://datastation.mydomain.com" // The address users will enter into the browser to use the app
    "tlsKey": "/home/server/certs/datastation.key.pem", // Can be left blank and set at the reverse-proxy level if desired
    "tlsCert": "/home/server/certs/datastation.cert.pem",
  },

  "database": {
    "address": "localhost", // Address of your PostgreSQL instance
    "username": "datastation", // Should be a dedicated PostgreSQL user for DataStation
    "password": "some good password",
    "database": "datastation" // Should be a dedicated database within PostgreSQL for DataStation
  }
}
```
