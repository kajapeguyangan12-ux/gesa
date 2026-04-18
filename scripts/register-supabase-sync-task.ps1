$ErrorActionPreference = "Stop"

$taskName = if ($env:SYNC_TASK_NAME) { $env:SYNC_TASK_NAME } else { "GesaSupabaseSync" }
$projectRoot = Split-Path -Parent $PSScriptRoot
$intervalMinutes = if ($env:SYNC_INTERVAL_MINUTES) { [int]$env:SYNC_INTERVAL_MINUTES } else { 5 }
$syncProfile = if ($env:SYNC_PROFILE) { $env:SYNC_PROFILE } else { "" }
$syncMode = if ($env:SYNC_MODE) { $env:SYNC_MODE } else { "incremental" }
$incrementalSync = if ($env:INCREMENTAL_SYNC) { $env:INCREMENTAL_SYNC } else { "true" }

if ($intervalMinutes -lt 1) {
  throw "SYNC_INTERVAL_MINUTES must be at least 1."
}

$commandParts = @(
  "cd /d `"$projectRoot`"",
  "set SYNC_MODE=$syncMode",
  "set INCREMENTAL_SYNC=$incrementalSync"
)

if ($syncProfile) {
  $commandParts += "set SYNC_PROFILE=$syncProfile"
}

$commandParts += "npm.cmd run sync:supabase:once"

$taskCommand = 'cmd.exe /c "' + ($commandParts -join " && ") + '"'

$arguments = @(
  "/Create",
  "/TN", $taskName,
  "/TR", $taskCommand,
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
Write-Host "Profile: $(if ($syncProfile) { $syncProfile } else { 'default' })"
Write-Host "Sync mode: $syncMode"
Write-Host "Incremental: $incrementalSync"
Write-Host "Interval: $intervalMinutes minute(s)"
Write-Host "Verify with: schtasks /Query /TN $taskName /V /FO LIST"
