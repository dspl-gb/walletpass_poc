# Converts Apple Pass Type material into the PEM files this app reads.
# Drop pass.cer / Certificates.p12 into certs/apple, then run:
#   powershell -File scripts/convert-apple-certs.ps1

$ErrorActionPreference = "Stop"
$appleDir = Join-Path (Split-Path $PSScriptRoot -Parent) "certs\apple"
New-Item -ItemType Directory -Force -Path $appleDir | Out-Null

function Convert-DerCerToPem([string]$cerPath, [string]$pemPath) {
  $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($cerPath)
  $b64 = [Convert]::ToBase64String($cert.RawData)
  $lines = for ($i = 0; $i -lt $b64.Length; $i += 64) {
    $b64.Substring($i, [Math]::Min(64, $b64.Length - $i))
  }
  $pem = "-----BEGIN CERTIFICATE-----`n$($lines -join "`n")`n-----END CERTIFICATE-----`n"
  Set-Content -Path $pemPath -Value $pem -NoNewline -Encoding ascii
  Write-Host "Wrote $pemPath ($($cert.Subject))"
}

function Find-OpenSsl {
  $candidates = @(
    "C:\Program Files\Git\usr\bin\openssl.exe",
    "C:\Program Files\OpenSSL-Win64\bin\openssl.exe"
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { return $c }
  }
  $cmd = Get-Command openssl -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

$signerCer = @(
  Get-ChildItem $appleDir -Filter "*.cer" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notmatch "WWDR" }
) | Select-Object -First 1

if ($signerCer) {
  Convert-DerCerToPem $signerCer.FullName (Join-Path $appleDir "signerCert.pem")
} else {
  $existingPem = Get-ChildItem $appleDir -Filter "*.pem" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notmatch "^(wwdr|signerCert|signerKey)\.pem$" } |
    Select-Object -First 1
  if ($existingPem) {
    Copy-Item -LiteralPath $existingPem.FullName -Destination (Join-Path $appleDir "signerCert.pem") -Force
    Write-Host "Copied $($existingPem.Name) to signerCert.pem"
  } elseif (-not (Test-Path (Join-Path $appleDir "signerCert.pem"))) {
    Write-Host "No Pass Type .cer found. Export the certificate from Apple Developer and save it as certs/apple/pass.cer"
  }
}

$p12 = Get-ChildItem $appleDir -Filter "*.p12" -ErrorAction SilentlyContinue | Select-Object -First 1
$keyPem = Join-Path $appleDir "signerKey.pem"
if ($p12) {
  $openssl = Find-OpenSsl
  if (-not $openssl) {
    Write-Host "Found $($p12.Name) but openssl is not installed. Install Git for Windows, then rerun this script."
    Write-Host "Or run: openssl pkcs12 -in `"$($p12.FullName)`" -nocerts -nodes -out `"$keyPem`""
  } else {
    $password = Read-Host "Password for $($p12.Name) (blank if none)"
    $args = @("pkcs12", "-in", $p12.FullName, "-nocerts", "-nodes", "-out", $keyPem)
    if ($password) { $args += @("-passin", "pass:$password") }
    & $openssl @args
    if ($LASTEXITCODE -ne 0) { throw "openssl pkcs12 failed with exit $LASTEXITCODE" }
    Write-Host "Wrote $keyPem"
  }
} elseif (-not (Test-Path $keyPem)) {
  Write-Host "No .p12 found. Export the private key as certs/apple/Certificates.p12"
}

$wwdrPem = Join-Path $appleDir "wwdr.pem"
if (-not (Test-Path $wwdrPem)) {
  $cer = Join-Path $appleDir "AppleWWDRCAG4.cer"
  Invoke-WebRequest -Uri "https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer" -OutFile $cer -UseBasicParsing
  Convert-DerCerToPem $cer $wwdrPem
  Remove-Item $cer
}

Write-Host "Done. Restart npm run dev after signerCert.pem and signerKey.pem exist."
Write-Host ""
Write-Host "For Vercel, copy these one-line base64 values into environment variables:"
foreach ($pair in @(
  @{ Label = "APPLE_CERTIFICATE_BASE64"; File = "signerCert.pem" },
  @{ Label = "APPLE_PRIVATE_KEY_BASE64"; File = "signerKey.pem" },
  @{ Label = "APPLE_WWDR_CERTIFICATE_BASE64"; File = "wwdr.pem" }
)) {
  $path = Join-Path $appleDir $pair.File
  if (Test-Path $path) {
    $bytes = [IO.File]::ReadAllBytes($path)
    $b64 = [Convert]::ToBase64String($bytes)
    Write-Host ""
    Write-Host "$($pair.Label)=$b64"
  }
}
