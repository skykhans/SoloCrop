$ErrorActionPreference = 'Stop'

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host 'git not found, skip requirement coverage check'
  exit 0
}

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$inside = cmd /c "git rev-parse --is-inside-work-tree 2>nul"
if ($LASTEXITCODE -ne 0 -or $inside -notmatch 'true') {
  Write-Host 'not a git repository, skip requirement coverage check'
  exit 0
}

cmd /c "git rev-parse --verify HEAD 1>nul 2>nul"
if ($LASTEXITCODE -ne 0) {
  $changes = cmd /c "git diff --name-only --cached"
} else {
  $changes = cmd /c "git diff --name-only HEAD"
}

if (-not $changes) {
  Write-Host 'no changes detected, requirement coverage check passed'
  exit 0
}

$requirementRelativePath = 'docs\' + [string]([char]0x9700) + [char]0x6C42 + [char]0x6587 + [char]0x6863 + '.md'
$requirementFile = Join-Path $root $requirementRelativePath
if (-not (Test-Path $requirementFile)) {
  Write-Error "required document not found: $requirementRelativePath"
  exit 1
}

$featureCodeChanged = $false
$requirementDocChanged = $false
foreach ($line in $changes) {
  if (
    $line -like 'frontend/src/features/*' -or
    $line -like 'frontend/src/stores/*' -or
    $line -like 'frontend/src/views/*' -or
    $line -like 'frontend/src/components/*'
  ) {
    $featureCodeChanged = $true
  }
  if ($line -eq $requirementRelativePath.Replace('\', '/')) {
    $requirementDocChanged = $true
  }
}

if ($featureCodeChanged -and -not $requirementDocChanged) {
  Write-Error 'feature code changed but the requirement document was not updated'
  exit 1
}

$content = Get-Content -Raw $requirementFile
$requiredRows = $content -split "`n" | Where-Object { $_ -match '\|\s*是\s*\|' }
foreach ($row in $requiredRows) {
  if ($row -match '\|\s*(未开始|进行中|可用)\s*\|') {
    Write-Error "required feature not accepted yet: $row"
    exit 1
  }
  if ($row -match '\|\s*-\s*\|') {
    Write-Error "required feature has missing fields: $row"
    exit 1
  }
  if ($row -notmatch '\|\s*E2E-[A-Z-0-9]+\s*\|') {
    Write-Error "required feature missing PlaywrightCaseID: $row"
    exit 1
  }
  if ($row -notmatch '\|\s*PASS\s*\|') {
    Write-Error "required feature latest result is not PASS: $row"
    exit 1
  }
}

Write-Host 'requirement coverage check passed'