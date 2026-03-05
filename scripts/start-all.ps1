param(
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root 'frontend'
$port = 5173

if (-not (Test-Path $frontend)) {
  throw 'frontend 目录不存在'
}

Set-Location $frontend

if ((-not $SkipInstall) -and (-not (Test-Path (Join-Path $frontend 'node_modules')))) {
  npm install
}

npm run sync:ffmpeg-core

# Kill stale process on same port to avoid serving old bundle.
$pids = @()
if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
  $listening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($listening) {
    $pids = $listening | Select-Object -ExpandProperty OwningProcess -Unique
  }
} else {
  $raw = netstat -ano | Select-String ":$port"
  foreach ($line in $raw) {
    $parts = ($line.ToString() -replace '\s+', ' ').Trim().Split(' ')
    if ($parts.Length -ge 5 -and $parts[3] -eq 'LISTENING') {
      $pids += [int]$parts[4]
    }
  }
  $pids = $pids | Select-Object -Unique
}

foreach ($pid in $pids) {
  try {
    Stop-Process -Id $pid -Force -ErrorAction Stop
    Write-Host "Stopped process on port $port: PID $pid"
  } catch {
    Write-Host "Failed to stop PID $pid on port $port: $($_.Exception.Message)"
    }
  }

Write-Host "Starting Vite on http://127.0.0.1:$port (strictPort + force)..."
npm run dev -- --host 127.0.0.1 --port $port --strictPort --force
