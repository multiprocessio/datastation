Invoke-Expression (New-Object System.Net.WebClient).DownloadString('https://get.scoop.sh')
Join-Path (Resolve-Path ~).Path "scoop\shims" >> $Env:GITHUB_PATH
scoop install nodejs@16 cmake python yarn zip jq curl go r julia
yarn
Remove-Item -Recurse -Force "node_modules/canvas"
go install github.com/google/go-jsonnet/cmd/jsonnet@latest

New-Alias zip 7z