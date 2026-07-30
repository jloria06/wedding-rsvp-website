param(
    [ValidateSet("development", "staging", "production")]
    [string]$Environment = "development"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Projects\wedding-rsvp"
$BackendDirectory = Join-Path $ProjectRoot "backend"
$EnvironmentFile = Join-Path $BackendDirectory ".env"
$BackupRoot = Join-Path $ProjectRoot "backups"

if (-not (Test-Path $EnvironmentFile)) {
    throw "Backend environment file not found: $EnvironmentFile"
}

$EnvironmentValues = @{}

Get-Content $EnvironmentFile |
    Where-Object {
        $_ -and
        -not $_.TrimStart().StartsWith("#") -and
        $_ -match "="
    } |
    ForEach-Object {
        $Name, $Value = $_ -split "=", 2
        $EnvironmentValues[$Name.Trim()] = $Value.Trim()
    }

if ($Environment -ne "development") {
    throw "Only the development backup is configured locally in Phase 3."
}

$RequiredVariables = @(
    "DATABASE_HOST",
    "DATABASE_PORT",
    "DATABASE_NAME",
    "DATABASE_USER",
    "DATABASE_PASSWORD"
)

foreach ($Variable in $RequiredVariables) {
    if (-not $EnvironmentValues.ContainsKey($Variable)) {
        throw "Missing required environment variable: $Variable"
    }
}

$MySQLDump = Get-ChildItem `
    "C:\Program Files\MySQL" `
    -Filter mysqldump.exe `
    -Recurse `
    -ErrorAction SilentlyContinue |
    Select-Object -First 1

if (-not $MySQLDump) {
    throw "mysqldump.exe was not found."
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$EnvironmentBackupDirectory = Join-Path $BackupRoot $Environment

New-Item `
    -ItemType Directory `
    -Path $EnvironmentBackupDirectory `
    -Force | Out-Null

$BackupFile = Join-Path `
    $EnvironmentBackupDirectory `
    "$($EnvironmentValues['DATABASE_NAME'])-$Timestamp.sql"

$env:MYSQL_PWD = $EnvironmentValues["DATABASE_PASSWORD"]

try {
 & $MySQLDump.FullName `
    --host=$($EnvironmentValues["DATABASE_HOST"]) `
    --port=$($EnvironmentValues["DATABASE_PORT"]) `
    --user=$($EnvironmentValues["DATABASE_USER"]) `
    --single-transaction `
    --skip-add-locks `
    --skip-lock-tables `
    --no-tablespaces `
    --triggers `
    --set-gtid-purged=OFF `
    --result-file=$BackupFile `
    $EnvironmentValues["DATABASE_NAME"]

    if ($LASTEXITCODE -ne 0) {
        throw "mysqldump failed with exit code $LASTEXITCODE."
    }

    if (-not (Test-Path $BackupFile)) {
        throw "Backup file was not created."
    }

    $BackupInfo = Get-Item $BackupFile

    Write-Host "[PASSED] Database backup completed." -ForegroundColor Green
    Write-Host "Environment: $Environment"
    Write-Host "Database: $($EnvironmentValues['DATABASE_NAME'])"
    Write-Host "Backup file: $($BackupInfo.FullName)"
    Write-Host "Size: $($BackupInfo.Length) bytes"
}
finally {
    Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
}