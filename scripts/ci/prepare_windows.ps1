Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$PSDefaultParameterValues['*:ErrorAction']='Stop'
function ThrowOnNativeFailure {
    if (-not $?)
    {
        throw 'Native Failure'
    }
}

# Windows things in Github Actions (at least) fail all the time. So
# every network-related command should be wrapped in this Retry
# helper.
# Source: https://stackoverflow.com/a/41554667/1507139
function Retry {
  [CmdletBinding()]
  Param(
    [Parameter(Mandatory=$true)]
    [scriptblock]$Cmd,

    [Parameter(Mandatory=$false)]
    [int]$Count = 5
  )

  Begin {
    $attempt = $Count
    $success = $false
  }
  Process {
    while ($attempt -gt 0 -and -not $success) {
      try {
        $res = Invoke-Command -ScriptBlock $Cmd -ErrorAction Stop
        $success = $true
      } catch {
        $ex = $_    # remember error information
        $attempt--
      }
    }
  }
  End {
    if ($success) {
      return ,$res
    } else {
      throw $ex
    }
  }
}

iwr -useb 'https://raw.githubusercontent.com/scoopinstaller/install/master/install.ps1' -outfile 'install.ps1'
.\install.ps1 -RunAsAdmin
Join-Path (Resolve-Path ~).Path "scoop\shims" >> $Env:GITHUB_PATH
Retry -Cmd { scoop install nodejs-lts go@1.18.3 cmake python yarn zip jq curl julia }
New-Alias zip 7z

# Issue with go race detector 4k allignment instead of 64k.
# https://github.com/golang/go/issues/46099
# Temporary fix by downgraeding gcc and friends.
choco install mingw --version 10.2.0 --allow-downgrade

# Install JS dependencies
Retry -Cmd { yarn }
Retry -Cmd { yarn rebuild }

# Install Go
# curl -L -O "https://go.dev/dl/go1.18.windows-amd64.zip"
# unzip go1.18.windows-amd64.zip
# Join-Path $pwd "go\bin" >> $Env:GITHUB_PATH

Retry -Cmd { go install github.com/google/go-jsonnet/cmd/jsonnet@latest }
Retry -Cmd { go install github.com/multiprocessio/httpmirror@latest }

# Set up `go install` bin path
Join-Path (Resolve-Path ~).Path "go\bin" >> $Env:GITHUB_PATH

$outpath = "c:/odbc.msi"
Retry -Cmd { Invoke-WebRequest -Uri "https://go.microsoft.com/fwlink/?linkid=2187028" -OutFile $outpath }
Start-Process -Filepath $outpath -ArgumentList "/qr IACCEPTMSODBCSQLLICENSETERMS=YES"