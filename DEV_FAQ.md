## yarn test vs yarn test-local

The latter just doesn't involve running test coverage which takes
longer and isn't that useful locally.

## Jest crashes with too many workers exception

Run tests again with `--runInBand`: `yarn test-local --runInBand`.

## The packaged app is not starting, giving error messages

You can debug by editing the built artifact, for example: `vi
'.\releases\DataStation Community Edition-win32-x64\resources\app\build\desktop.js'` and adding console
statements or throwing exceptions and bisecting until you find the
issue.

## Program tests keep failing

Make sure the runner is up to date by running `yarn build-desktop`.

## While testing "await is only allowed in async function" but function is async

ts-jest blows up in weird ways when there are syntax errors. Remove
all the `await`s (even if that would be incorrect) and it will lead
you closer to the real problem. Even then it probably won't be
accurate. It doesn't seem to handle syntax errors pretty terribly in
general.

Should move to something that is not ts-jest eventually.

## Run a single JavaScript test-local file

Pass the test-local file name to `yarn test`.

```bash
yarn test-local server/exporter.test.js
```

## Run tests on only a single runner type

All (or should be all) tests on panels run both against a Node version
and a Go version. To quickly filter on only a specific runner, you can
pass `--dsrunner=X` where X is `memory` or `go` or `node` and only
tests against that runner will be run.

For example:

```bash
yarn test-local desktop/panel/file.test.js --dsrunner=memory
```

## Adding/editing language libraries

Language libraries (i.e. the implementation of
DM_getPanel/DM_setPanel) are in shared/libraries/*.jsonnet. They are
in jsonnet so that you can have nicely formatted code. They get
compiled to JSON and committed. They also get embedded into Go code.

To re-run this process, use on Mac or Linux:

```
$ yarn build-language-definitions
```
