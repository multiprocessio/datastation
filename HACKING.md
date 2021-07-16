# Hacking

You'll need a recent Node.js, Python, cmake, and
[yarn](https://yarnpkg.com/).

If you want to have hot-reloading, install
[fswatch](https://github.com/emcrisostomo/fswatch).

## Build and run the UI

This will start a web server for the in-browser application. If you
have fswatch it will also build the UI:

```
yarn start-ui
```

If you don't have fswatch or want to manually trigger a build of the UI app, run this:

```
yarn build-ui
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

## Building a release

This needs to be done on each supported platform.

```
yarn release-desktop $version
```
