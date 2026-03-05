$ErrorActionPreference = 'Stop'

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host 'git not found, skip doc sync check'
  exit 0
}

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$inside = cmd /c "git rev-parse --is-inside-work-tree 2>nul"
if ($LASTEXITCODE -ne 0 -or $inside -notmatch 'true') {
  Write-Host 'not a git repository, skip doc sync check'
  exit 0
}

cmd /c "git rev-parse --verify HEAD 1>nul 2>nul"
if ($LASTEXITCODE -ne 0) {
  $changes = cmd /c "git diff --name-only --cached"
} else {
  $changes = cmd /c "git diff --name-only HEAD"
}

if (-not $changes) {
  Write-Host 'no changes detected, doc sync check passed'
  exit 0
}

$codeChanged = $false
$docsChanged = $false

foreach ($line in $changes) {
  if ($line -match '^(frontend)/') {
    $codeChanged = $true
  }

  if ($line -match '^docs/') {
    $docsChanged = $true
  }
}

if ($codeChanged -and -not $docsChanged) {
  Write-Error 'frontend code changed but docs were not updated'
  exit 1
}

Write-Host 'doc sync check passed'
