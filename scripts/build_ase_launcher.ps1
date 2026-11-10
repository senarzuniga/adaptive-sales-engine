$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $compiler)) {
    $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
}
if (-not (Test-Path $compiler)) { throw 'No se encontro el compilador C# de .NET Framework.' }
& $compiler /nologo /target:exe "/out:$root\ASE_Lovable.exe" "$root\launcher\AseLovableLauncher.cs"
if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar ASE_Lovable.exe.' }
Write-Output "Ejecutable generado: $root\ASE_Lovable.exe"