$ErrorActionPreference = "Stop"

$taskName = "GesaSupabaseSync"
$projectRoot = Split-Path -Parent $PSScriptRoot
$runnerPath = Join-Path $PSScriptRoot "windows-run-supabase-sync.cmd"
$intervalMinutes = if ($env:SYNC_INTERVAL_MINUTES) { [int]$env:SYNC_INTERVAL_MINUTES } else { 120 }

if (-not (Test-Path $runnerPath)) {
  throw "Runner file not found: $runnerPath"
}

if ($intervalMinutes -lt 1) {
  throw "SYNC_INTERVAL_MINUTES must be at least 1."
}

$escapedRunner = '"' + $runnerPath + '"'

$arguments = @(
  "/Create",
  "/TN", $taskName,
  "/TR", $escapedRunner,
  "/SC", "MINUTE",
  "/MO", "$intervalMinutes",
  "/F",
  "/RL", "HIGHEST"
)

$process = Start-Process -FilePath "schtasks.exe" -ArgumentList $arguments -Wait -NoNewWindow -PassThru

if ($process.ExitCode -ne 0) {
  throw "schtasks.exe failed with exit code $($process.ExitCode)."
}

Write-Host "Scheduled task '$taskName' registered."
Write-Host "Project root: $projectRoot"
Write-Host "Runner: $runnerPath"
Write-Host "Interval: $intervalMinutes minute(s)"
Write-Host "Verify with: schtasks /Query /TN $taskName /V /FO LIST"
