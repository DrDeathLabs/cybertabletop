param(
  [Parameter(Mandatory=$true)][string]$BackupFile,
  [string]$PostgresContainer = "cybertabletop-postgres-1",
  [string]$PostgresUser = "cybertabletop",
  [string]$PostgresDb = "cybertabletop"
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $BackupFile)) {
  throw "Backup file not found: $BackupFile"
}

$workDir = Join-Path ([System.IO.Path]::GetTempPath()) ("cybertabletop-restore-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $workDir | Out-Null
try {
  Expand-Archive -LiteralPath $BackupFile -DestinationPath $workDir -Force
  $sql = Get-ChildItem -Path $workDir -Filter *.sql | Select-Object -First 1
  if (-not $sql) { throw "No .sql file found in $BackupFile" }
  Get-Content -LiteralPath $sql.FullName | docker exec -i $PostgresContainer psql -U $PostgresUser -d $PostgresDb -v ON_ERROR_STOP=1
  Write-Host "Restore complete"
} finally {
  Remove-Item -LiteralPath $workDir -Recurse -Force
}
