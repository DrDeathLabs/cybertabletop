#Requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root '.env'
$SslDir = Join-Path $Root 'nginx\ssl'

function New-RandomHex {
    param([int]$Bytes = 32)
    $buffer = New-Object byte[] $Bytes
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $rng.GetBytes($buffer)
    $rng.Dispose()
    -join ($buffer | ForEach-Object { $_.ToString('x2') })
}

function New-RandomAlnum {
    param([int]$Length = 40)
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    $bytes = New-Object byte[] $Length
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    $result = New-Object System.Text.StringBuilder
    foreach ($byte in $bytes) {
        [void]$result.Append($chars[$byte % $chars.Length])
    }
    $result.ToString()
}

function New-RandomBase64 {
    param([int]$Bytes = 32)
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $buffer = New-Object byte[] $Bytes
    $rng.GetBytes($buffer)
    $rng.Dispose()
    [Convert]::ToBase64String($buffer)
}

function Test-Command {
    param([string]$Name)
    $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

if (Test-Path $EnvFile) {
    Write-Host ".env already exists; leaving it unchanged."
} else {
    Write-Host "Creating .env with random local secrets..."
    Copy-Item (Join-Path $Root '.env.example') $EnvFile

    $postgresPassword = New-RandomAlnum 40
    $redisPassword = New-RandomAlnum 40
    $jwtSecret = New-RandomHex 32
    $jwtRefreshSecret = New-RandomHex 32
    $sessionSecret = New-RandomHex 24
    $mfaEncryptionKey = New-RandomBase64 32
    $inviteCode = New-RandomAlnum 48

    $content = Get-Content $EnvFile -Raw
    $content = $content.Replace('CHANGE_ME_DB_PASSWORD', $postgresPassword)
    $content = $content.Replace('CHANGE_ME_REDIS_PASSWORD', $redisPassword)
    $content = $content.Replace('CHANGE_ME_LONG_RANDOM_SECRET_MIN_64_CHARS', $jwtSecret)
    $content = $content.Replace('CHANGE_ME_DIFFERENT_LONG_RANDOM_SECRET_MIN_64_CHARS', $jwtRefreshSecret)
    $content = $content.Replace('CHANGE_ME_SESSION_SECRET', $sessionSecret)
    $content = $content.Replace('CHANGE_ME_BASE64_32_BYTE_KEY', $mfaEncryptionKey)
    $content = $content.Replace('CHANGE_ME_LONG_RANDOM_INVITE_CODE', $inviteCode)
    Set-Content -Path $EnvFile -Value $content -NoNewline

    Write-Host "Created .env"
    Write-Host "Registration invite code: $inviteCode"
}

New-Item -ItemType Directory -Force -Path $SslDir | Out-Null
$CertPath = Join-Path $SslDir 'cert.pem'
$KeyPath = Join-Path $SslDir 'key.pem'

if ((Test-Path $CertPath) -and (Test-Path $KeyPath)) {
    Write-Host "Local TLS certificate already exists; leaving it unchanged."
} else {
    Write-Host "Generating local self-signed TLS certificate for localhost..."

    if (Test-Command openssl) {
        & openssl req -x509 -nodes -newkey rsa:4096 -sha256 -days 365 `
            -keyout $KeyPath `
            -out $CertPath `
            -subj "/CN=localhost" `
            -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
    } elseif (Test-Command docker) {
        Write-Host "OpenSSL is not on PATH; using Docker to generate the certificate..."
        $mount = "${SslDir}:/certs"
        & docker run --rm -v $mount alpine/openssl req -x509 -nodes -newkey rsa:4096 -sha256 -days 365 `
            -keyout /certs/key.pem `
            -out /certs/cert.pem `
            -subj "/CN=localhost" `
            -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
    } else {
        throw "Missing required command: openssl or docker. Install Docker Desktop, install OpenSSL, or use the full install.ps1 helper."
    }

    if ($LASTEXITCODE -ne 0) {
        throw "TLS certificate generation failed."
    }
    Write-Host "Created nginx/ssl/cert.pem and nginx/ssl/key.pem"
}

Write-Host ""
Write-Host "Bootstrap complete."
Write-Host "Start with prebuilt images:"
Write-Host "  docker compose -p cybertabletop -f docker-compose.pull.yml up -d"
