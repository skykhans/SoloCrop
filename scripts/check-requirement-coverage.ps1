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

$requirementFile = Join-Path $root 'docs\需求文档.md'
if (-not (Test-Path $requirementFile)) {
  Write-Error 'docs/需求文档.md 不存在'
  exit 1
}

$featureCodeChanged = $false
$requirementDocChanged = $false
foreach ($line in $changes) {
  if ($line -match '^frontend/src/(features|stores|views|components)/') {
    $featureCodeChanged = $true
  }
  if ($line -eq 'docs/需求文档.md') {
    $requirementDocChanged = $true
  }
}

if ($featureCodeChanged -and -not $requirementDocChanged) {
  Write-Error '检测到功能代码变更，但 docs/需求文档.md 未同步更新'
  exit 1
}

$content = Get-Content -Raw $requirementFile
$requiredRows = $content -split "`n" | Where-Object { $_ -match '\|\s*是\s*\|' }
foreach ($row in $requiredRows) {
  if ($row -match '\|\s*(未开始|进行中|可用)\s*\|') {
    Write-Error "存在本轮必须项未验收: $row"
    exit 1
  }
  if ($row -match '\|\s*-\s*\|') {
    Write-Error "存在本轮必须项缺少字段: $row"
    exit 1
  }
  if ($row -notmatch '\|\s*E2E-[A-Z-0-9]+\s*\|') {
    Write-Error "存在本轮必须项缺少 PlaywrightCaseID: $row"
    exit 1
  }
  if ($row -notmatch '\|\s*PASS\s*\|') {
    Write-Error "存在本轮必须项最近验收结果非 PASS: $row"
    exit 1
  }
}

Write-Host 'requirement coverage check passed'
