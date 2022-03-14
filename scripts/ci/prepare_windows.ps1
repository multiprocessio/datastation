iwr -useb 'https://raw.githubusercontent.com/scoopinstaller/install/master/install.ps1' -outfile 'install.ps1'
.\install.ps1 -RunAsAdmin
Join-Path (Resolve-Path ~).Path "scoop\shims" >> $Env:GITHUB_PATH
scoop install nodejs@16 cmake python yarn zip jq curl go r julia
yarn
go install github.com/google/go-jsonnet/cmd/jsonnet@latest
go install github.com/multiprocessio/httpmirror@latest
Join-Path (Resolve-Path ~).Path "go\bin" >> $Env:GITHUB_PATH

New-Alias zip 7z