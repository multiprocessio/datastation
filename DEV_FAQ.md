## Jest crashes with too many workers exception

Run tests again with `--runInBand`: `yarn test --runInBand`.

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

## Run a single test

Pass the test file name to `yarn test`.

```bash
yarn test server/exporter.test.js
```