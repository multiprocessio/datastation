Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$PSDefaultParameterValues['*:ErrorAction']='Stop'
function ThrowOnNativeFailure {
    if (-not $?)
    {
        throw 'Native Failure'
    }
}

iwr -useb 'https://raw.githubusercontent.com/scoopinstaller/install/master/install.ps1' -outfile 'install.ps1'
.\install.ps1 -RunAsAdmin
Join-Path (Resolve-Path ~).Path "scoop\shims" >> $Env:GITHUB_PATH
scoop install nodejs-lts
scoop install go@1.18.3
scoop install cmake
scoop install python
scoop install yarn
scoop install zip
scoop install jq
scoop install curl
scoop install julia
New-Alias zip 7z

# Issue with go race detector 4k allignment instead of 64k.
# https://github.com/golang/go/issues/46099
# Temporary fix by downgraeding gcc and friends.
gcc -v
choco install mingw --version 10.2.0 --allow-downgrade

# Install JS dependencies
yarn
yarn
yarn
yarn
yarn
# Windows builds fail a lot
yarn rebuild

# Install Go
# curl -L -O "https://go.dev/dl/go1.18.windows-amd64.zip"
# unzip go1.18.windows-amd64.zip
# Join-Path $pwd "go\bin" >> $Env:GITHUB_PATH

go install github.com/google/go-jsonnet/cmd/jsonnet@latest
go install github.com/multiprocessio/httpmirror@latest

# Set up `go install` bin path
Join-Path (Resolve-Path ~).Path "go\bin" >> $Env:GITHUB_PATH

$outpath = "c:/odbc.msi"
Invoke-WebRequest -Uri "https://go.microsoft.com/fwlink/?linkid=2187028" -OutFile $outpath
Start-Process -Filepath $outpath -ArgumentList "/qr IACCEPTMSODBCSQLLICENSETERMS=YES"

# Start up sqlserver
docker run -d -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=1StrongPwd!!" -p 1433:1433 tobiasfenster/mssql-server-dev-unsupported:2019-latest
