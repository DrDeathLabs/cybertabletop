#Requires -Version 5.1
<#
.SYNOPSIS
    CyberTabletop – Windows Installation Script

.DESCRIPTION
    Installs prerequisites (Docker Desktop, Node.js 20 LTS, Git), generates
    TLS certificates, sets up environment variables, and pre-fetches Docker images
    for the CyberTabletop cybersecurity tabletop exercise platform.

.NOTES
    Run from the project root directory.
    Requires PowerShell 5.1 or later.
    Recommended: run from an elevated (Administrator) PowerShell session.
#>

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Color helpers
# ---------------------------------------------------------------------------
function Write-Info    { param([string]$Msg) Write-Host "[INFO]  $Msg" -ForegroundColor Cyan }
function Write-Success { param([string]$Msg) Write-Host "[OK]    $Msg" -ForegroundColor Green }
function Write-Warn    { param([string]$Msg) Write-Host "[WARN]  $Msg" -ForegroundColor Yellow }
function Write-Err     { param([string]$Msg) Write-Host "[ERROR] $Msg" -ForegroundColor Red }
function Write-Fatal   {
    param([string]$Msg)
    Write-Host "[FATAL] $Msg" -ForegroundColor Red
    exit 1
}

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  ____      _               _____     _     _      _" -ForegroundColor Cyan
Write-Host " / ___|   _| |__   ___ _ __|_   _|_ _| |__ | | ___| |_ ___  _ __" -ForegroundColor Cyan
Write-Host "| |  | | | | '_ \ / _ \ '__| | |/ _\` | '_ \| |/ _ \ __/ _ \| '_ \" -ForegroundColor Cyan
Write-Host "| |__| |_| | |_) |  __/ |    | | (_| | |_) | |  __/ || (_) | |_) |" -ForegroundColor Cyan
Write-Host " \____\__, |_.__/ \___|_|    |_|\__,_|_.__/|_|\___|\__\___/| .__/" -ForegroundColor Cyan
Write-Host "      |___/                                                  |_|" -ForegroundColor Cyan
Write-Host ""
Write-Host "CyberTabletop Installation Script (Windows)" -ForegroundColor White
Write-Host "============================================" -ForegroundColor White
Write-Host ""

# ---------------------------------------------------------------------------
# PowerShell version check
# ---------------------------------------------------------------------------
$psVersion = $PSVersionTable.PSVersion
Write-Info "PowerShell version: $($psVersion.ToString())"

if ($psVersion.Major -lt 5 -or ($psVersion.Major -eq 5 -and $psVersion.Minor -lt 1)) {
    Write-Fatal "PowerShell 5.1 or later is required. Current version: $($psVersion.ToString()). " +
                "Download from: https://aka.ms/wmf51download"
}
Write-Success "PowerShell version check passed: $($psVersion.ToString())"

# ---------------------------------------------------------------------------
# Project root (script location)
# ---------------------------------------------------------------------------
$ProjectRoot = $PSScriptRoot
if (-not $ProjectRoot) {
    $ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}
Write-Info "Project root: $ProjectRoot"

# ---------------------------------------------------------------------------
# Check winget availability
# ---------------------------------------------------------------------------
$WingetAvailable = $false
try {
    $null = Get-Command winget -ErrorAction Stop
    $wingetVersion = (winget --version 2>$null)
    Write-Success "winget available: $wingetVersion"
    $WingetAvailable = $true
}
catch {
    Write-Warn "winget (Windows Package Manager) is not available."
    Write-Warn "To install winget, open the Microsoft Store and install 'App Installer'."
    Write-Warn "Alternatively, download from: https://aka.ms/getwinget"
    Write-Host ""
}

# ---------------------------------------------------------------------------
# Helper: check if a command exists
# ---------------------------------------------------------------------------
function Test-Command {
    param([string]$Name)
    $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

# ---------------------------------------------------------------------------
# Install via winget with idempotency
# ---------------------------------------------------------------------------
function Install-WithWinget {
    param(
        [string]$PackageId,
        [string]$DisplayName,
        [string]$FallbackUrl
    )

    if ($WingetAvailable) {
        Write-Info "Installing $DisplayName via winget…"
        try {
            winget install --id $PackageId --silent --accept-package-agreements --accept-source-agreements
            Write-Success "$DisplayName installed via winget."
        }
        catch {
            Write-Warn "winget install failed for $DisplayName. Error: $_"
            Write-Warn "Please install manually from: $FallbackUrl"
        }
    }
    else {
        Write-Warn "winget not available. Install $DisplayName manually:"
        Write-Host "  Download: $FallbackUrl" -ForegroundColor Yellow
    }
}

# ---------------------------------------------------------------------------
# Install Docker Desktop
# ---------------------------------------------------------------------------
function Install-Docker {
    # Check if Docker is already installed and running
    if (Test-Command 'docker') {
        try {
            $dockerVersion = docker --version 2>$null
            Write-Success "Docker already installed: $dockerVersion"
        }
        catch {
            Write-Warn "Docker command found but may not be running."
        }

        if (docker compose version 2>$null) {
            Write-Success "Docker Compose plugin available."
        }
        return
    }

    Write-Info "Docker Desktop not found."

    if ($WingetAvailable) {
        Install-WithWinget `
            -PackageId 'Docker.DockerDesktop' `
            -DisplayName 'Docker Desktop' `
            -FallbackUrl 'https://www.docker.com/products/docker-desktop/'

        Write-Host ""
        Write-Warn "IMPORTANT: Docker Desktop has been installed but requires additional setup:"
        Write-Warn "  1. Launch Docker Desktop from the Start Menu"
        Write-Warn "  2. Accept the license agreement"
        Write-Warn "  3. Complete the Docker Desktop setup wizard"
        Write-Warn "  4. Ensure Docker Desktop shows 'Engine running' in the system tray"
        Write-Warn "  5. Re-run this script once Docker is running"
        Write-Host ""
    }
    else {
        Write-Host ""
        Write-Host "Docker Desktop Installation Instructions:" -ForegroundColor Yellow
        Write-Host "  1. Download Docker Desktop from: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
        Write-Host "  2. Run the installer (Docker Desktop Installer.exe)" -ForegroundColor Yellow
        Write-Host "  3. Follow the setup wizard (enable WSL 2 backend when prompted)" -ForegroundColor Yellow
        Write-Host "  4. Restart your computer if prompted" -ForegroundColor Yellow
        Write-Host "  5. Launch Docker Desktop and wait for 'Engine running' status" -ForegroundColor Yellow
        Write-Host "  6. Re-run this script" -ForegroundColor Yellow
        Write-Host ""
        Write-Fatal "Docker Desktop is required. Please install it and re-run this script."
    }
}

# ---------------------------------------------------------------------------
# Install Node.js 20 LTS
# ---------------------------------------------------------------------------
function Install-NodeJS {
    if (Test-Command 'node') {
        $nodeVersion = node --version 2>$null
        $major = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
        if ($major -ge 20) {
            Write-Success "Node.js already installed: $nodeVersion"
            $npmVersion = npm --version 2>$null
            Write-Success "npm: $npmVersion"
            return
        }
        else {
            Write-Warn "Node.js $nodeVersion found but version 20+ is required. Upgrading…"
        }
    }

    Install-WithWinget `
        -PackageId 'OpenJS.NodeJS.LTS' `
        -DisplayName 'Node.js 20 LTS' `
        -FallbackUrl 'https://nodejs.org/en/download/'

    # Refresh PATH so node is available in this session
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [System.Environment]::GetEnvironmentVariable('Path', 'User')

    if (Test-Command 'node') {
        Write-Success "Node.js installed: $(node --version)"
    }
    else {
        Write-Warn "Node.js installed but not yet in PATH. You may need to restart your terminal."
    }
}

# ---------------------------------------------------------------------------
# Install Git
# ---------------------------------------------------------------------------
function Install-Git {
    if (Test-Command 'git') {
        Write-Success "Git already installed: $(git --version)"
        return
    }

    Install-WithWinget `
        -PackageId 'Git.Git' `
        -DisplayName 'Git' `
        -FallbackUrl 'https://git-scm.com/download/win'

    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [System.Environment]::GetEnvironmentVariable('Path', 'User')

    if (Test-Command 'git') {
        Write-Success "Git installed: $(git --version)"
    }
    else {
        Write-Warn "Git installed but may require a terminal restart."
    }
}

# ---------------------------------------------------------------------------
# Create nginx\ssl directory
# ---------------------------------------------------------------------------
function New-SslDirectory {
    $SslDir = Join-Path $ProjectRoot 'nginx\ssl'
    if (-not (Test-Path $SslDir)) {
        Write-Info "Creating $SslDir…"
        New-Item -ItemType Directory -Path $SslDir -Force | Out-Null
    }
    Write-Success "nginx\ssl directory ready: $SslDir"
    return $SslDir
}

# ---------------------------------------------------------------------------
# Generate self-signed TLS certificate and export as PEM files
# ---------------------------------------------------------------------------
function New-TlsCertificate {
    param([string]$SslDir)

    $CertFile = Join-Path $SslDir 'cert.pem'
    $KeyFile  = Join-Path $SslDir 'key.pem'

    if ((Test-Path $CertFile) -and (Test-Path $KeyFile)) {
        Write-Warn "TLS certificate files already exist. Skipping generation."
        Write-Warn "Delete $SslDir\cert.pem and key.pem to regenerate."
        return
    }

    Write-Info "Generating self-signed TLS certificate (2-year expiry)…"

    try {
        # Create the certificate in the certificate store
        $cert = New-SelfSignedCertificate `
            -DnsName 'localhost', '127.0.0.1' `
            -CertStoreLocation 'Cert:\CurrentUser\My' `
            -NotAfter (Get-Date).AddYears(2) `
            -KeyAlgorithm RSA `
            -KeyLength 4096 `
            -KeyExportPolicy Exportable `
            -Subject 'CN=localhost, O=CyberTabletop, OU=Dev' `
            -FriendlyName 'CyberTabletop Dev Certificate' `
            -HashAlgorithm SHA256

        $thumbprint = $cert.Thumbprint

        # ---------------------------------------------------------------------------
        # Export certificate (public key) as PEM
        # ---------------------------------------------------------------------------
        $certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
        $certBase64 = [System.Convert]::ToBase64String($certBytes, [System.Base64FormattingOptions]::InsertLineBreaks)
        $certPem = "-----BEGIN CERTIFICATE-----`r`n$certBase64`r`n-----END CERTIFICATE-----"
        [System.IO.File]::WriteAllText($CertFile, $certPem)

        # ---------------------------------------------------------------------------
        # Export private key as PEM
        # ---------------------------------------------------------------------------
        # Use PFX as intermediate (ephemeral password)
        $pfxPassword = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
        $pwdBytes = New-Object byte[] 16
        $pfxPassword.GetBytes($pwdBytes)
        $pfxPwd = [System.Convert]::ToBase64String($pwdBytes)
        $pfxSecure = ConvertTo-SecureString -String $pfxPwd -Force -AsPlainText

        $pfxBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $pfxPwd)
        $pfxPath  = Join-Path $env:TEMP 'cybertabletop_tmp.pfx'
        [System.IO.File]::WriteAllBytes($pfxPath, $pfxBytes)

        # Use openssl (if available) to extract the private key from PFX
        if (Test-Command 'openssl') {
            & openssl pkcs12 -in $pfxPath -nocerts -nodes -passin "pass:$pfxPwd" -out $KeyFile 2>$null
            Write-Success "Private key exported via openssl."
        }
        else {
            # Fallback: extract RSA key using .NET cryptography
            $pkcs12 = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
                $pfxPath, $pfxPwd,
                [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable
            )
            $rsa = $pkcs12.GetRSAPrivateKey()
            if ($null -ne $rsa) {
                $keyBytes = $rsa.ExportRSAPrivateKey()
                $keyBase64 = [System.Convert]::ToBase64String($keyBytes, [System.Base64FormattingOptions]::InsertLineBreaks)
                $keyPem = "-----BEGIN RSA PRIVATE KEY-----`r`n$keyBase64`r`n-----END RSA PRIVATE KEY-----"
                [System.IO.File]::WriteAllText($KeyFile, $keyPem)
                Write-Success "Private key exported via .NET RSA export."
            }
            else {
                Write-Warn "Could not export private key automatically."
                Write-Warn "Install openssl (https://slproweb.com/products/Win32OpenSSL.html) and re-run,"
                Write-Warn "or manually export the certificate from certmgr.msc (Thumbprint: $thumbprint)."
            }
        }

        # Cleanup temp PFX
        if (Test-Path $pfxPath) { Remove-Item $pfxPath -Force }

        # Clean up cert from store (we only needed it for export)
        Remove-Item "Cert:\CurrentUser\My\$thumbprint" -Force -ErrorAction SilentlyContinue

        Write-Success "TLS certificates written to $SslDir\"
        Write-Info  "  cert.pem  – public certificate"
        Write-Info  "  key.pem   – private key (keep this secret)"
    }
    catch {
        Write-Err "Certificate generation failed: $_"
        Write-Warn "You may need to run this script as Administrator for certificate operations."
        Write-Warn "Or generate certificates manually using openssl:"
        Write-Warn "  openssl req -x509 -nodes -newkey rsa:4096 -keyout nginx\ssl\key.pem -out nginx\ssl\cert.pem -days 730 -subj '/CN=localhost'"
    }
}

# ---------------------------------------------------------------------------
# Copy .env.example to .env
# ---------------------------------------------------------------------------
function Initialize-EnvFile {
    $EnvFile    = Join-Path $ProjectRoot '.env'
    $EnvExample = Join-Path $ProjectRoot '.env.example'

    if (-not (Test-Path $EnvExample)) {
        Write-Fatal ".env.example not found at $ProjectRoot. Cannot continue."
    }

    if (Test-Path $EnvFile) {
        Write-Warn ".env already exists. Skipping copy (secrets will still be regenerated)."
    }
    else {
        Copy-Item $EnvExample $EnvFile
        Write-Success "Copied .env.example to .env"
    }

    return $EnvFile
}

# ---------------------------------------------------------------------------
# Cryptographically secure random string generators
# ---------------------------------------------------------------------------
function New-SecureHex {
    param([int]$Bytes)
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $buffer = New-Object byte[] $Bytes
    $rng.GetBytes($buffer)
    $rng.Dispose()
    return ($buffer | ForEach-Object { $_.ToString('x2') }) -join ''
}

function New-SecureAlphanumeric {
    param([int]$Length)
    $rng     = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    $result  = New-Object System.Text.StringBuilder
    $buffer  = New-Object byte[] 1

    while ($result.Length -lt $Length) {
        $rng.GetBytes($buffer)
        $index = $buffer[0] % $charset.Length
        # Reject indices in the bias zone to ensure uniform distribution
        if ($buffer[0] -lt [Math]::Floor(256 / $charset.Length) * $charset.Length) {
            $null = $result.Append($charset[$index])
        }
    }
    $rng.Dispose()
    return $result.ToString()
}

function New-SecureBase64 {
    param([int]$Bytes)
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $buffer = New-Object byte[] $Bytes
    $rng.GetBytes($buffer)
    $rng.Dispose()
    return [Convert]::ToBase64String($buffer)
}

# ---------------------------------------------------------------------------
# Inject secrets into .env
# ---------------------------------------------------------------------------
function Set-EnvSecrets {
    param([string]$EnvFile)

    Write-Info "Generating secure random secrets…"

    $JwtSecret        = New-SecureHex 32          # 64 hex chars
    $JwtRefreshSecret = New-SecureHex 32          # 64 hex chars
    $SessionSecret    = New-SecureHex 16          # 32 hex chars
    $MfaEncryptionKey = New-SecureBase64 32       # 32-byte base64 key
    $PostgresPassword = New-SecureAlphanumeric 32
    $RedisPassword    = New-SecureAlphanumeric 32

    function Update-EnvVar {
        param([string]$File, [string]$Key, [string]$Value)
        $content = Get-Content $File -Raw
        if ($content -match "(?m)^$Key=") {
            # Replace existing value
            $content = $content -replace "(?m)^$Key=.*", "$Key=$Value"
        }
        else {
            # Append if key doesn't exist
            $content = $content.TrimEnd() + "`r`n$Key=$Value`r`n"
        }
        Set-Content -Path $File -Value $content -NoNewline
    }

    Update-EnvVar -File $EnvFile -Key 'JWT_SECRET'          -Value $JwtSecret
    Update-EnvVar -File $EnvFile -Key 'JWT_REFRESH_SECRET'  -Value $JwtRefreshSecret
    Update-EnvVar -File $EnvFile -Key 'SESSION_SECRET'      -Value $SessionSecret
    Update-EnvVar -File $EnvFile -Key 'MFA_ENCRYPTION_KEY'  -Value $MfaEncryptionKey
    Update-EnvVar -File $EnvFile -Key 'POSTGRES_PASSWORD'   -Value $PostgresPassword
    Update-EnvVar -File $EnvFile -Key 'REDIS_PASSWORD'      -Value $RedisPassword

    Write-Success "Secrets written to .env"
    Write-Info "  JWT_SECRET:          $($JwtSecret.Substring(0,16))… (truncated)"
    Write-Info "  JWT_REFRESH_SECRET:  $($JwtRefreshSecret.Substring(0,16))… (truncated)"
    Write-Info "  SESSION_SECRET:      $($SessionSecret.Substring(0,8))… (truncated)"
    Write-Info "  MFA_ENCRYPTION_KEY:  $($MfaEncryptionKey.Substring(0,8))… (truncated)"
    Write-Info "  POSTGRES_PASSWORD:   $($PostgresPassword.Substring(0,8))… (truncated)"
    Write-Info "  REDIS_PASSWORD:      $($RedisPassword.Substring(0,8))… (truncated)"
}

# ---------------------------------------------------------------------------
# Pre-fetch Docker images
# ---------------------------------------------------------------------------
function Invoke-DockerPull {
    Write-Info "Pre-fetching Docker images (docker compose pull)…"
    Push-Location $ProjectRoot
    try {
        docker compose pull
        Write-Success "Docker images pulled."
    }
    catch {
        Write-Warn "Some images could not be pulled: $_"
        Write-Warn "They will be pulled automatically on first 'docker compose up'."
    }
    finally {
        Pop-Location
    }
}

# ---------------------------------------------------------------------------
# Success message
# ---------------------------------------------------------------------------
function Write-SuccessMessage {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "  CyberTabletop installation complete!" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor White
    Write-Host ""
    Write-Host "  1. " -NoNewline -ForegroundColor Yellow
    Write-Host "(Optional) " -NoNewline -ForegroundColor White
    Write-Host "Edit .env to configure SSO providers or AI integrations:" -ForegroundColor White
    Write-Host "       notepad $ProjectRoot\.env" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  2. " -NoNewline -ForegroundColor Yellow
    Write-Host "Start all services:" -ForegroundColor White
    Write-Host "       docker compose up -d" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "       Database migrations and built-in scenarios are applied automatically when the backend starts." -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  3. " -NoNewline -ForegroundColor Yellow
    Write-Host "Open the application:" -ForegroundColor White
    Write-Host "       https://localhost" -ForegroundColor Cyan
    Write-Host "       (Accept the self-signed certificate warning in your browser)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  4. " -NoNewline -ForegroundColor Yellow
    Write-Host "Register your admin account:" -ForegroundColor White
    Write-Host "       The first account registered is automatically granted SUPER_ADMIN role." -ForegroundColor White
    Write-Host "       Privileged users must complete TOTP MFA setup before using the app." -ForegroundColor White
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
try {
    Install-Docker
    Write-Host ""
    Install-NodeJS
    Install-Git
    Write-Host ""

    $SslDir  = New-SslDirectory
    New-TlsCertificate -SslDir $SslDir
    Write-Host ""

    $EnvFile = Initialize-EnvFile
    Set-EnvSecrets -EnvFile $EnvFile
    Write-Host ""

    Invoke-DockerPull
    Write-SuccessMessage
}
catch {
    Write-Err "Installation failed: $_"
    Write-Err $_.ScriptStackTrace
    exit 1
}
