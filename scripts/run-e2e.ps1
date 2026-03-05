$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root 'frontend'
$port = 4174

if (-not (Test-Path $frontend)) {
  throw 'frontend 目录不存在'
}

Set-Location $frontend

npm run build
if ($LASTEXITCODE -ne 0) {
  throw 'npm run build failed'
}

$process = $null
try {
  $process = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'preview', '--', '--host', '127.0.0.1', '--port', "$port", '--strictPort') -PassThru
  Start-Sleep -Seconds 4
  npm run test:e2e:report
  if ($LASTEXITCODE -ne 0) {
    throw 'Playwright e2e failed'
  }
  Write-Host 'Playwright 报告路径: frontend/e2e/reports/index.html'
} finally {
  if ($process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
  }
}
