## Jest crashes with too many workers exception

Run tests again with `--runInBand`: `yarn test --runInBand`.

## The packaged app is not starting, giving error messages

You can debug by editing the built artifact, for example: `vi
'.\releases\DataStation Community Edition-win32-x64\resources\app\build\desktop.js'` and adding console
statements or throwing exceptions and bisecting until you find the
issue.

## Program tests keep failing

Make sure the runner is up to date by running `yarn build-desktop`.