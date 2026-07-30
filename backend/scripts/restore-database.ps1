param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,

    [ValidateSet("development")]
    [string]$Environment = "development",

    [switch]$ConfirmRestore
)

$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Projects\wedding-rsvp"
$BackendDirectory = Join-Path $ProjectRoot "backend"
$EnvironmentFile = Join-Path $BackendDirectory ".env"

if (-not $ConfirmRestore) {
    throw "Restore was not confirmed. Rerun with -ConfirmRestore."
}

if (-not (Test-Path $BackupFile -PathType Leaf)) {
    throw "Backup file was not found: $BackupFile"
}

if (-not (Test-Path $EnvironmentFile -PathType Leaf)) {
    throw "Backend environment file was not found: $EnvironmentFile"
}

if ($Environment -ne "development") {
    throw "Only development restore is configured during Phase 3."
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

$MySQLClient = Get-ChildItem `
    "C:\Program Files\MySQL" `
    -Filter mysql.exe `
    -Recurse `
    -ErrorAction SilentlyContinue |
    Select-Object -First 1

if (-not $MySQLClient) {
    throw "mysql.exe was not found."
}

$BackupInformation = Get-Item $BackupFile

Write-Host "Restore target details:" -ForegroundColor Yellow
Write-Host "Environment: $Environment"
Write-Host "Database: $($EnvironmentValues['DATABASE_NAME'])"
Write-Host "Backup file: $($BackupInformation.FullName)"
Write-Host "Backup size: $($BackupInformation.Length) bytes"

$env:MYSQL_PWD = $EnvironmentValues["DATABASE_PASSWORD"]

try {
    Get-Content `
        -Path $BackupFile `
        -Raw |
        & $MySQLClient.FullName `
            --host=$($EnvironmentValues["DATABASE_HOST"]) `
            --port=$($EnvironmentValues["DATABASE_PORT"]) `
            --user=$($EnvironmentValues["DATABASE_USER"]) `
            $EnvironmentValues["DATABASE_NAME"]

    if ($LASTEXITCODE -ne 0) {
        throw "MySQL restore failed with exit code $LASTEXITCODE."
    }

    Write-Host "[PASSED] Database restore completed." -ForegroundColor Green
    Write-Host "Database: $($EnvironmentValues['DATABASE_NAME'])"
}
finally {
    Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
}