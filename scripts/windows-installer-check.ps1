[CmdletBinding()]
param([switch]$IconOnly)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$output = Join-Path $repo 'output\playwright'
$version = (Get-Content -LiteralPath (Join-Path $repo 'package.json') -Raw | ConvertFrom-Json).version
$temporary = Join-Path ([IO.Path]::GetTempPath()) ('pdfuck-installer-' + [guid]::NewGuid())
$testKey = 'Software\PDFuckInstallerSmoke\' + [guid]::NewGuid()
$compiler = Get-ChildItem -LiteralPath (Join-Path $env:LOCALAPPDATA 'electron-builder\Cache') -Recurse -Filter makensis.exe | Select-Object -First 1 -ExpandProperty FullName
if (-not $compiler) { throw 'Build the NSIS installer first to populate the compiler cache.' }
New-Item -ItemType Directory -Path $temporary, $output -Force | Out-Null
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class PDFuckInstallerUI {
  public delegate bool EnumProc(IntPtr hwnd, IntPtr arg);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr arg);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr hwnd, EnumProc callback, IntPtr arg);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int max);
  public static string Text(int pid) {
    var texts = new List<string>();
    EnumProc read = (hwnd,arg) => { var value=new StringBuilder(4096); GetWindowText(hwnd,value,value.Capacity); texts.Add(value.ToString()); return true; };
    EnumWindows((hwnd,arg)=>{uint owner;GetWindowThreadProcessId(hwnd,out owner);if(owner==pid){read(hwnd,arg);EnumChildWindows(hwnd,read,arg);}return true;},IntPtr.Zero);
    return String.Join("\n",texts);
  }
}
'@
$template = @'
Unicode true
RequestExecutionLevel user
Name "PDFuck installer check"
OutFile "__OUTPUT__"
!include MUI2.nsh
!define VERSION "__VERSION__"
!define APP_EXECUTABLE_FILENAME "PDFuck.exe"
!define INSTALL_REGISTRY_KEY "__KEY__"
!define UNINSTALL_REGISTRY_KEY "__UNINSTALL__"
!define MUI_ICON "__ROOT__\resources\icon.ico"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP "__ROOT__\resources\installer-header.bmp"
!include "__ROOT__\resources\installer.nsh"
!insertmacro customWelcomePage
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Japanese"
!insertmacro MUI_LANGUAGE "Russian"
!insertmacro MUI_LANGUAGE "SpanishInternational"
!insertmacro MUI_LANGUAGE "French"
!insertmacro MUI_LANGUAGE "German"
!insertmacro MUI_LANGUAGE "PortugueseBR"
!insertmacro MUI_LANGUAGE "Korean"
!insertmacro MUI_LANGUAGE "Arabic"
!insertmacro customHeader
Function .onInit
  SetRegView 64
  StrCpy $LANGUAGE 2052
FunctionEnd
Section
SectionEnd
'@
$results = @()
try {
  foreach ($scenario in $(if ($IconOnly) { @() } else { @('fresh','user-installed','stale-record','machine-installed') })) {
    $key = $testKey
    $uninstall = $testKey + '\Uninstall'
    if ($scenario -eq 'user-installed' -or $scenario -eq 'stale-record') {
      $location = Join-Path $temporary 'mock-install'
      New-Item -ItemType Directory -Path $location -Force | Out-Null
      if ($scenario -eq 'user-installed') { [IO.File]::WriteAllBytes((Join-Path $location 'PDFuck.exe'), [byte[]]@(0)) }
      else { Remove-Item -LiteralPath (Join-Path $location 'PDFuck.exe') -ErrorAction SilentlyContinue }
      New-Item -Path ('HKCU:\' + $key), ('HKCU:\' + $uninstall) -Force | Out-Null
      New-ItemProperty -LiteralPath ('HKCU:\' + $key) -Name InstallLocation -Value $location -Force | Out-Null
      New-ItemProperty -LiteralPath ('HKCU:\' + $uninstall) -Name DisplayVersion -Value '2.0.99' -Force | Out-Null
    }
    if ($scenario -eq 'machine-installed') {
      $key = 'Software\b076989a-039f-5bef-8171-4d874ca1ac61'
      $uninstall = 'Software\Microsoft\Windows\CurrentVersion\Uninstall\b076989a-039f-5bef-8171-4d874ca1ac61'
      $installed = Get-ItemProperty -LiteralPath ('HKLM:\' + $key) -ErrorAction SilentlyContinue
      if (-not $installed -or -not (Test-Path -LiteralPath (Join-Path $installed.InstallLocation 'PDFuck.exe'))) { continue }
    }
    $exe = Join-Path $temporary ($scenario + '.exe')
    $script = Join-Path $temporary ($scenario + '.nsi')
    $text = $template.Replace('__OUTPUT__',$exe).Replace('__ROOT__',$repo).Replace('__VERSION__',$version).Replace('__KEY__',$key).Replace('__UNINSTALL__',$uninstall)
    [IO.File]::WriteAllText($script,$text,[Text.UTF8Encoding]::new($false))
    & $compiler /V1 $script
    if ($LASTEXITCODE -ne 0) { throw "NSIS harness compilation failed: $scenario" }
    $process = Start-Process -FilePath $exe -PassThru -WindowStyle Hidden
    try {
      $captured = ''
      for ($attempt=0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 150
        $captured = [PDFuckInstallerUI]::Text($process.Id)
        if ($captured.Contains('检测') -or $captured.Contains('已安装')) { break }
      }
      if ($scenario -eq 'user-installed') {
        if (-not $captured.Contains('2.0.99') -or -not $captured.Contains($location) -or -not $captured.Contains('保留')) { throw "User installation prompt failed: $captured" }
      } elseif ($scenario -eq 'machine-installed') {
        if (-not $captured.Contains($installed.InstallLocation) -or -not $captured.Contains('保留')) { throw "Machine installation prompt failed: $captured" }
      } elseif (-not $captured.Contains('未检测到已有安装')) { throw "Fresh installation prompt failed: $captured" }
      $results += [ordered]@{ scenario=$scenario; text=$captured }
    } finally { if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force } }
  }
  $installer = Join-Path $repo "release\PDFuck-$version-Windows-Setup.exe"
  $actualIcon = [Drawing.Icon]::ExtractAssociatedIcon($installer)
  $expectedIcon = [Drawing.Icon]::ExtractAssociatedIcon((Join-Path $repo 'resources\icon.ico'))
  $actual = $actualIcon.ToBitmap(); $expected = $expectedIcon.ToBitmap()
  try {
    for ($y=0;$y -lt $actual.Height;$y++) { for($x=0;$x -lt $actual.Width;$x++) { if ($actual.GetPixel($x,$y).ToArgb() -ne $expected.GetPixel($x,$y).ToArgb()) { throw ('Installer EXE icon differs at ' + $x + ',' + $y + ': ' + $actual.GetPixel($x,$y) + ' / ' + $expected.GetPixel($x,$y)) } } }
    $actual.Save((Join-Path $output "release-$version-installer-icon.png"))
  } finally { $actual.Dispose();$expected.Dispose();$actualIcon.Dispose();$expectedIcon.Dispose() }
  [ordered]@{ version=$version; icon='actual installer EXE icon matches the application ICO pixel for pixel'; scenarios=$results; scope='reused production NSIS page; only isolated HKCU test keys were written; real HKLM installation read only; no installation performed' } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output "release-$version-installer.json") -Encoding utf8
  Write-Host "Installer logo and $($results.Count) status scenarios passed."
} finally {
  # Remove only the unique registry fixture created above; never touch application registry entries.
  if ($testKey -notmatch '^Software\\PDFuckInstallerSmoke\\[0-9a-f-]{36}$') { throw 'Unexpected test registry path.' }
  Remove-Item -LiteralPath ('HKCU:\' + $testKey) -Recurse -ErrorAction SilentlyContinue
}
