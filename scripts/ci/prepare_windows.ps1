Set-StrictMode -Version 3
$ErrorActionPreference = "Stop"
$PSDefaultParameterValues['*:ErrorAction']='Stop'
$LASTEXITCODE = 0

# Windows things in Github Actions (at least) fail all the time. So
# every network-related command should be wrapped in this Retry
# helper.
function Retry {
    Param([scriptblock] $Cmd)
    $retries = 5
    $retrycount = 0
    while ($retrycount++ -lt $retries) {
	Invoke-Command -ScriptBlock $cmd
	if ($LASTEXITCODE -ne 0) {
	    $retries = $retries + 1
	    echo "Retrying after sleep"
	    Start-Sleep -Seconds 2
	    continue
	}
	return
    }
    throw "Max retries reached"
}

Retry -Cmd { Invoke-WebRequest -useb 'https://raw.githubusercontent.com/scoopinstaller/install/master/install.ps1' -outfile 'install.ps1' }
.\install.ps1 -RunAsAdmin
Join-Path (Resolve-Path ~).Path "scoop\shims" >> $Env:GITHUB_PATH
Retry -Cmd { scoop install nodejs-lts }
Retry -Cmd { scoop install go@1.20.2 }
Retry -Cmd { scoop install cmake }
Retry -Cmd { scoop install python }
Retry -Cmd { scoop install yarn }
Retry -Cmd { scoop install zip }
Retry -Cmd { scoop install jq }
Retry -Cmd { scoop install curl }
Retry -Cmd { scoop install julia }
New-Alias zip 7z

# Install JS dependencies
Retry -Cmd { yarn }
Retry -Cmd { yarn rebuild }

# Install Go
# curl -L -O "https://go.dev/dl/go1.20.2.windows-amd64.zip"
# unzip go1.20.2.windows-amd64.zip
# Join-Path $pwd "go\bin" >> $Env:GITHUB_PATH

Retry -Cmd { go install github.com/google/go-jsonnet/cmd/jsonnet@latest }
Retry -Cmd { go install github.com/multiprocessio/httpmirror@latest }

# Set up `go install` bin path
Join-Path (Resolve-Path ~).Path "go\bin" >> $Env:GITHUB_PATH

$outpath = "c:/odbc.msi"
Retry -Cmd { Invoke-WebRequest -Uri "https://go.microsoft.com/fwlink/?linkid=2187028" -OutFile $outpath }
Start-Process -Filepath $outpath -ArgumentList "/qr IACCEPTMSODBCSQLLICENSETERMS=YES"
