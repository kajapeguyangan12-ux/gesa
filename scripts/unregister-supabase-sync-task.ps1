$ErrorActionPreference = "Stop"

$taskName = "GesaSupabaseSync"
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if (-not $existingTask) {
  Write-Host "Scheduled task '$taskName' not found."
  exit 0
}

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Write-Host "Scheduled task '$taskName' removed."
