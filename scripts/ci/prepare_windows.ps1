iwr -useb 'https://raw.githubusercontent.com/scoopinstaller/install/master/install.ps1' -outfile 'install.ps1'
.\install.ps1 -RunAsAdmin
Join-Path (Resolve-Path ~).Path "scoop\shims" >> $Env:GITHUB_PATH
scoop install nodejs@16.13.0
scoop install go@1.18.1
scoop install cmake
scoop install python
scoop install yarn
scoop install zip
scoop install jq
scoop install curl
scoop install julia
New-Alias zip 7z

# Install JS dependencies
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
docker run -d -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=1StrongPwd!!" -p 1433:1433 octopusdeploy/mssql-server-windows-express
