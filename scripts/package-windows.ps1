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

function Get-Sha256Hash {
  param([Parameter(Mandatory = $true)][string]$Path)
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try { return ([System.BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-', '') }
    finally { $algorithm.Dispose() }
  } finally { $stream.Dispose() }
}

function Get-EmbeddedSigner {
  param([Parameter(Mandatory = $true)][string]$Path)
  try {
    $certificate = [System.Security.Cryptography.X509Certificates.X509Certificate]::CreateFromSignedFile($Path)
    try { return $certificate.Subject }
    finally { $certificate.Dispose() }
  } catch { return $null }
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
  Invoke-Native -Command 'npm' -Arguments @('run', 'test:print-native')
  Invoke-Native -Command 'npm' -Arguments @('run', 'test:print-ui')
  Invoke-Native -Command 'npm' -Arguments @('run', 'test:window-tabs')
  Invoke-Native -Command 'npm' -Arguments @('run', 'test:page-text-edit-ui')
  Invoke-Native -Command 'npm' -Arguments @('run', 'test:page-manager-input-ui')
  Invoke-Native -Command 'npm' -Arguments @('run', 'test:selection-scheduling')
  Invoke-Native -Command 'npm' -Arguments @('run', 'test:selection-scheduling-ui')
  Invoke-Native -Command 'npm' -Arguments @('run', 'test:selection-scheduling-0826')
  Invoke-Native -Command 'npm' -Arguments @('run', 'test:selection-scheduling-0826-ui')
  Invoke-Native -Command 'npm' -Arguments @('run', 'test:selection-test2')
  Invoke-Native -Command 'npm' -Arguments @('run', 'test:selection-test2-ui')
  Invoke-Native -Command 'npm' -Arguments @('run', 'test:citations-scheduling-0826')
  Invoke-Native -Command 'npm' -Arguments @('run', 'test:reading-navigation-ui')
  Invoke-Native -Command 'npm' -Arguments @('run', 'test:selection-chinese')
  Invoke-Native -Command 'npm' -Arguments @('run', 'test:selection-chinese-ui')
  Invoke-Native -Command 'git' -Arguments @('diff', '--check')
  # npm ci has already installed this exact Electron version. Reuse its local
  # distribution so packaging does not perform a second GitHub download.
  Invoke-Native -Command 'npx' -Arguments @('--no-install', 'electron-builder', '--win', '--config.electronDist=node_modules/electron/dist')

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
  $nativeUnpacked = Join-Path $releaseDirectory 'win-unpacked\resources\app.asar.unpacked\node_modules\windows-pdf-printer-native'
  $nativeIndex = Join-Path $nativeUnpacked 'lib\index.js'
  $nativePdfium = Join-Path $nativeUnpacked 'bin\pdfium.dll'
  $nativeLicense = Join-Path $nativeUnpacked 'LICENSE'
  foreach ($requiredNative in @($nativeIndex, $nativePdfium, $nativeLicense)) {
    if (-not (Test-Path -LiteralPath $requiredNative -PathType Leaf)) { throw "Packaged native print resource is missing: $requiredNative" }
  }
  if (-not (Select-String -LiteralPath $nativeIndex -SimpleMatch './core/types/index.js' -Quiet)) { throw 'Packaged native printer ESM patch is missing.' }
  if ((Get-Item -LiteralPath $nativePdfium).Length -lt 1000000) { throw 'Packaged PDFium DLL is incomplete.' }
  if (-not (Select-String -LiteralPath $nativeLicense -SimpleMatch 'MIT License' -Quiet)) { throw 'Packaged native printer license is missing.' }
  $koffiUnpacked = Join-Path $releaseDirectory 'win-unpacked\resources\app.asar.unpacked\node_modules\koffi'
  if (-not (Test-Path -LiteralPath $koffiUnpacked -PathType Container)) { throw "Packaged native Koffi runtime is missing: $koffiUnpacked" }
  $fileVersion = (Get-Item -LiteralPath $unpackedExecutable).VersionInfo.ProductVersion
  if (-not $fileVersion.StartsWith($currentVersion)) { throw "PDFuck.exe product version is $fileVersion, expected $currentVersion." }
  Invoke-Native -Command $unpackedExecutable -Arguments @('--validate-print-backend')

  $env:PDFUCK_RELEASE_EXECUTABLE = $unpackedExecutable
  $env:PDFUCK_RELEASE_VERSION = $currentVersion
  Invoke-Native -Command 'node' -Arguments @('scripts/release-ui-smoke.cjs')
  $env:PDFUCK_SMOKE_EXECUTABLE = $unpackedExecutable
  Invoke-Native -Command 'node' -Arguments @('scripts/print-ui-smoke.cjs')
  Invoke-Native -Command 'node' -Arguments @('scripts/page-manager-input-ui-smoke.cjs')
  Invoke-Native -Command 'node' -Arguments @('scripts/selection-scheduling-0826-ui-smoke.cjs')
  Invoke-Native -Command 'node' -Arguments @('scripts/selection-test2-ui-smoke.cjs')
  Invoke-Native -Command 'node' -Arguments @('scripts/reading-navigation-ui-smoke.cjs')
  Invoke-Native -Command 'node' -Arguments @('scripts/selection-chinese-alignment-ui-smoke.cjs')

  $artifacts = @($installer, $portable)
  # Use the framework implementation so release hashing also works in minimal
  # Windows PowerShell hosts where Get-FileHash is not available after packaging.
  $hashes = $artifacts | ForEach-Object { [pscustomobject]@{ Path = $_; Hash = Get-Sha256Hash -Path $_ } }
  $signatures = $artifacts | ForEach-Object {
    $signer = Get-EmbeddedSigner -Path $_
    [ordered]@{ file = $_; status = if ($signer) { 'Signed' } else { 'NotSigned' }; signer = $signer }
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
    tests = @('typecheck', 'unit', 'i18n-catalogue', 'i18n-ui', 'print-native-cjs', 'print-ui', 'window-tabs', 'page-text-edit-ui', 'page-manager-input-ui', 'selection-scheduling', 'selection-scheduling-ui', 'selection-scheduling-0826', 'selection-scheduling-0826-ui', 'selection-test2', 'selection-test2-ui', 'citations-scheduling-0826', 'reading-navigation-ui', 'selection-chinese', 'selection-chinese-ui', 'packaged-native-backend', 'packaged-release-ui', 'packaged-print-ui', 'packaged-page-manager-input-ui', 'packaged-selection-scheduling-0826-ui', 'packaged-selection-test2-ui', 'packaged-reading-navigation-ui', 'packaged-selection-chinese-ui')
  } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding utf8

  Write-Host "Windows release passed build, regression, packaged-app, version and hash checks." -ForegroundColor Green
  Write-Host "Installer: $installer"
  Write-Host "Portable:  $portable"
  Write-Host "Manifest:  $manifestPath"
  $hashes | Format-Table -AutoSize
} finally {
  Pop-Location
}
