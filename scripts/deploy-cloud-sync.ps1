param(
  [string]$ProjectId = $env:GCP_PROJECT_ID,
  [string]$Region = $env:GCP_REGION,
  [string]$ServiceName = $env:CLOUD_RUN_SYNC_SERVICE,
  [string]$SchedulerJobName = $env:CLOUD_SCHEDULER_SYNC_JOB,
  [string]$Schedule = $env:CLOUD_SCHEDULER_SYNC_SCHEDULE,
  [string]$TimeZone = $env:CLOUD_SCHEDULER_TIMEZONE,
  [string]$SyncProfile = $env:SYNC_PROFILE,
  [string]$SyncMode = $env:SYNC_MODE,
  [string]$SyncCollections = $env:SYNC_COLLECTIONS,
  [string]$MigrationBatchSize = $env:MIGRATION_BATCH_SIZE,
  [string]$SupabaseUrl = $env:SUPABASE_URL,
  [string]$SupabaseServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY,
  [string]$FirebaseServiceAccountJson = $env:FIREBASE_SERVICE_ACCOUNT_JSON,
  [string]$FirebaseServiceAccountBase64 = $env:FIREBASE_SERVICE_ACCOUNT_BASE64,
  [string]$SyncEndpointToken = $env:SYNC_ENDPOINT_TOKEN,
  [switch]$SkipBuild,
  [switch]$SkipDeploy,
  [switch]$SkipScheduler
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Region)) { $Region = "asia-southeast1" }
if ([string]::IsNullOrWhiteSpace($ServiceName)) { $ServiceName = "gesa-supabase-sync" }
if ([string]::IsNullOrWhiteSpace($SchedulerJobName)) { $SchedulerJobName = "gesa-supabase-sync-5m" }
if ([string]::IsNullOrWhiteSpace($Schedule)) { $Schedule = "*/5 * * * *" }
if ([string]::IsNullOrWhiteSpace($TimeZone)) { $TimeZone = "Asia/Singapore" }
if ([string]::IsNullOrWhiteSpace($SyncProfile)) { $SyncProfile = "backoffice" }
if ([string]::IsNullOrWhiteSpace($SyncMode)) { $SyncMode = "incremental" }
if ([string]::IsNullOrWhiteSpace($SyncCollections)) { $SyncCollections = "reports,user-admin" }
if ([string]::IsNullOrWhiteSpace($MigrationBatchSize)) { $MigrationBatchSize = "500" }

function Require-Value([string]$Name, [string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "Missing required value: $Name"
  }
}

Require-Value "ProjectId" $ProjectId
Require-Value "SupabaseUrl" $SupabaseUrl
Require-Value "SupabaseServiceRoleKey" $SupabaseServiceRoleKey
Require-Value "SyncEndpointToken" $SyncEndpointToken

if ([string]::IsNullOrWhiteSpace($FirebaseServiceAccountJson) -and [string]::IsNullOrWhiteSpace($FirebaseServiceAccountBase64)) {
  throw "Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_BASE64 before running deploy-cloud-sync.ps1"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$image = "gcr.io/$ProjectId/$ServiceName"
$serviceUrl = ""
$gcloud = "gcloud.cmd"
$tempEnvFile = Join-Path ([System.IO.Path]::GetTempPath()) "$ServiceName-cloudrun-env.yaml"

Write-Host "ProjectId           : $ProjectId"
Write-Host "Region              : $Region"
Write-Host "ServiceName         : $ServiceName"
Write-Host "SchedulerJobName    : $SchedulerJobName"
Write-Host "Schedule            : $Schedule"
Write-Host "SyncProfile         : $SyncProfile"
Write-Host "SyncMode            : $SyncMode"
Write-Host "SyncCollections     : $SyncCollections"
Write-Host "Image               : $image"

Push-Location $repoRoot
try {
  & $gcloud config set project $ProjectId | Out-Null

  if (-not $SkipBuild) {
    Write-Host "`n[1/4] Build container image"
    & $gcloud builds submit --config cloudbuild.sync.yaml .
    if ($LASTEXITCODE -ne 0) {
      throw "Cloud Build failed with exit code $LASTEXITCODE"
    }
  }

  if (-not $SkipDeploy) {
    Write-Host "`n[2/4] Deploy Cloud Run service"
    $envMap = [ordered]@{
      SYNC_STATE_BACKEND = "supabase"
      SUPABASE_SYNC_STATE_TABLE = "sync_state"
      INCREMENTAL_SYNC = "true"
      SYNC_MODE = $SyncMode
      SYNC_PROFILE = $SyncProfile
      SYNC_COLLECTIONS = $SyncCollections
      MIGRATION_BATCH_SIZE = $MigrationBatchSize
      SUPABASE_URL = $SupabaseUrl
      SUPABASE_SERVICE_ROLE_KEY = $SupabaseServiceRoleKey
      SYNC_ENDPOINT_TOKEN = $SyncEndpointToken
    }

    if (-not [string]::IsNullOrWhiteSpace($FirebaseServiceAccountJson)) {
      $envMap["FIREBASE_SERVICE_ACCOUNT_JSON"] = $FirebaseServiceAccountJson
    }

    if (-not [string]::IsNullOrWhiteSpace($FirebaseServiceAccountBase64)) {
      $envMap["FIREBASE_SERVICE_ACCOUNT_BASE64"] = $FirebaseServiceAccountBase64
    }

    $yamlLines = foreach ($entry in $envMap.GetEnumerator()) {
      $safeValue = ($entry.Value -replace '"', '\"')
      "$($entry.Key): ""$safeValue"""
    }
    Set-Content -LiteralPath $tempEnvFile -Value $yamlLines -Encoding UTF8

    $deployArgs = @(
      "run", "deploy", $ServiceName,
      "--image", $image,
      "--platform", "managed",
      "--region", $Region,
      "--allow-unauthenticated",
      "--env-vars-file", $tempEnvFile
    )

    & $gcloud @deployArgs
    if ($LASTEXITCODE -ne 0) {
      throw "Cloud Run deploy failed with exit code $LASTEXITCODE"
    }

    $serviceUrl = (& $gcloud run services describe $ServiceName --region $Region --format "value(status.url)").Trim()
    if ([string]::IsNullOrWhiteSpace($serviceUrl)) {
      throw "Failed to read Cloud Run service URL."
    }

    Write-Host "ServiceUrl          : $serviceUrl"
  }

  if (-not $SkipScheduler) {
    if ([string]::IsNullOrWhiteSpace($serviceUrl)) {
      $serviceUrl = (& $gcloud run services describe $ServiceName --region $Region --format "value(status.url)").Trim()
    }
    Require-Value "serviceUrl" $serviceUrl

    Write-Host "`n[3/4] Create or update Cloud Scheduler job"
    & $gcloud scheduler jobs describe $SchedulerJobName --location $Region | Out-Null
    $jobExists = $LASTEXITCODE -eq 0

    $schedulerArgs = @(
      "--location", $Region,
      "--schedule", $Schedule,
      "--time-zone", $TimeZone,
      "--uri", "$serviceUrl/sync?profile=$SyncProfile",
      "--http-method", "POST",
      "--headers", "Authorization=Bearer $SyncEndpointToken"
    )

    if ($jobExists) {
      & $gcloud scheduler jobs update http $SchedulerJobName @schedulerArgs
    } else {
      & $gcloud scheduler jobs create http $SchedulerJobName @schedulerArgs
    }

    if ($LASTEXITCODE -ne 0) {
      throw "Cloud Scheduler create/update failed with exit code $LASTEXITCODE"
    }
  }

  Write-Host "`n[4/4] Done"
  Write-Host "Cloud Run sync siap dipakai setiap 5 menit."
  if (-not [string]::IsNullOrWhiteSpace($serviceUrl)) {
    Write-Host "Health check        : $serviceUrl/healthz"
    Write-Host "Manual sync         : POST $serviceUrl/sync?profile=$SyncProfile"
  }
} finally {
  if (Test-Path -LiteralPath $tempEnvFile) {
    Remove-Item -LiteralPath $tempEnvFile -Force -ErrorAction SilentlyContinue
  }
  Pop-Location
}
