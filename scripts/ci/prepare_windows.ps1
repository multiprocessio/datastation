Invoke-Expression (New-Object System.Net.WebClient).DownloadString('https://get.scoop.sh')
Join-Path (Resolve-Path ~).Path "scoop\shims" >> $Env:GITHUB_PATH
scoop install nodejs cmake python yarn zip jq curl
yarn
rd /s /q node_modules/canvas

New-Alias zip 7z