Set-ExecutionPolicy RemoteSigned -scope CurrentUser
iwr -useb get.scoop.sh | iex
Join-Path (Resolve-Path ~).Path "scoop\shims" >> $Env:GITHUB_PATH
scoop install nodejs@16 cmake python yarn zip jq curl go r julia
yarn
go install github.com/google/go-jsonnet/cmd/jsonnet@latest

New-Alias zip 7z