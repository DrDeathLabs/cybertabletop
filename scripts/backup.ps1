param(
  [string]$BackupDir = ".\backups",
  [string]$PostgresContainer = "cybertabletop-postgres-1",
  [string]$PostgresUser = "cybertabletop",
  [string]$PostgresDb = "cybertabletop"
)

$ErrorActionPreference = "Stop"
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$out = Join-Path $BackupDir "cybertabletop-$stamp.sql"

docker exec $PostgresContainer pg_dump -U $PostgresUser $PostgresDb | Out-File -FilePath $out -Encoding utf8
Compress-Archive -Path $out -DestinationPath "$out.zip" -Force
Remove-Item -LiteralPath $out
Write-Host "Backup written to $out.zip"
