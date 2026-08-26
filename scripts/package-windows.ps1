[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidatePattern('^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$')]
  [string]$Version
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-Native {
  param([string]$Command, [string[]]$Arguments)
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): $Command $($Arguments -join ' ')" }
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Push-Location -LiteralPath $repoRoot
try {
  if ((& node -p "process.platform").Trim() -ne 'win32') { throw 'This packaging script must run on Windows.' }
  $nodeMajor = [int]((& node -p "process.versions.node.split('.')[0]").Trim())
  if ($nodeMajor -lt 22) { throw "Node.js 22 or newer is required; found $(& node --version)." }

  $existingVersion = (& node -p "require('./package.json').version").Trim()
  if ($Version -and $Version -ne $existingVersion) { Invoke-Native -Command 'npm' -Arguments @('version', $Version, '--no-git-tag-version') }
  $currentVersion = (& node -p "require('./package.json').version").Trim()
  $lockVersion = (& node -p "require('./package-lock.json').version").Trim()
  if ($currentVersion -ne $lockVersion) { throw "package.json ($currentVersion) and package-lock.json ($lockVersion) do not match." }

  Write-Host "Packaging PDFuck $currentVersion for Windows" -ForegroundColor Cyan
  Invoke-Native -Command 'npm' -Arguments @('ci')
  Invoke-Native -Command 'npm' -Arguments @('run', 'build')
  Invoke-Native -Command 'npm' -Arguments @('run', 'test:i18n-ui')
  Invoke-Native -Command 'npm' -Arguments @('run', 'test:window-tabs')
  Invoke-Native -Command 'npm' -Arguments @('run', 'test:selection-scheduling')
  Invoke-Native -Command 'npm' -Arguments @('run', 'test:selection-scheduling-ui')
  Invoke-Native -Command 'git' -Arguments @('diff', '--check')
  Invoke-Native -Command 'npx' -Arguments @('--no-install', 'electron-builder', '--win')

  $releaseDirectory = Join-Path $repoRoot 'release'
  $unpackedExecutable = Join-Path $releaseDirectory 'win-unpacked\PDFuck.exe'
  $asarPath = Join-Path $releaseDirectory 'win-unpacked\resources\app.asar'
  $installer = Join-Path $releaseDirectory "PDFuck-$currentVersion-Windows-Setup.exe"
  $portable = Join-Path $releaseDirectory "PDFuck-$currentVersion-Windows.exe"
  foreach ($required in @($unpackedExecutable, $asarPath, $installer, $portable)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Expected release artifact is missing: $required" }
  }

  $asarVersion = (& node -e "const asar=require('@electron/asar'); const value=JSON.parse(asar.extractFile(process.argv[1], 'package.json').toString()).version; process.stdout.write(value)" $asarPath).Trim()
  if ($asarVersion -ne $currentVersion) { throw "Packaged app.asar version is $asarVersion, expected $currentVersion." }
  $fileVersion = (Get-Item -LiteralPath $unpackedExecutable).VersionInfo.ProductVersion
  if (-not $fileVersion.StartsWith($currentVersion)) { throw "PDFuck.exe product version is $fileVersion, expected $currentVersion." }

  $env:PDFUCK_RELEASE_EXECUTABLE = $unpackedExecutable
  $env:PDFUCK_RELEASE_VERSION = $currentVersion
  Invoke-Native -Command 'node' -Arguments @('scripts/release-ui-smoke.cjs')

  $artifacts = @($installer, $portable)
  $hashes = $artifacts | ForEach-Object { Get-FileHash -LiteralPath $_ -Algorithm SHA256 }
  $signatures = $artifacts | ForEach-Object {
    $signature = Get-AuthenticodeSignature -LiteralPath $_
    [ordered]@{ file = $_; status = [string]$signature.Status; signer = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { $null } }
  }
  $manifestPath = Join-Path $releaseDirectory "PDFuck-$currentVersion-Windows-release.json"
  [ordered]@{
    product = 'PDFuck'
    version = $currentVersion
    platform = 'Windows'
    architecture = $env:PROCESSOR_ARCHITECTURE
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    unpackedExecutable = $unpackedExecutable
    packagedAsarVersion = $asarVersion
    executableProductVersion = $fileVersion
    artifacts = @($hashes | ForEach-Object { [ordered]@{ file = $_.Path; bytes = (Get-Item -LiteralPath $_.Path).Length; sha256 = $_.Hash } })
    signatures = $signatures
    tests = @('typecheck', 'unit', 'i18n-catalogue', 'i18n-ui', 'window-tabs', 'selection-scheduling', 'selection-scheduling-ui', 'packaged-release-ui')
  } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding utf8

  Write-Host "Windows release passed build, regression, packaged-app, version and hash checks." -ForegroundColor Green
  Write-Host "Installer: $installer"
  Write-Host "Portable:  $portable"
  Write-Host "Manifest:  $manifestPath"
  $hashes | Format-Table -AutoSize
} finally {
  Pop-Location
}
