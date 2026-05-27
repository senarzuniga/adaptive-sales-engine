# Sincronización de archivos desde ACS a adaptive-sales-engine
$source = "C:\Users\Inaki Senar\Documents\GitHub\ACS"
$dest = "C:\Users\Inaki Senar\Documents\GitHub\adaptive-sales-engine"

Write-Host "🔄 Sincronizando estructura desde ACS..." -ForegroundColor Cyan

# Directorios críticos a sincronizar
$criticalDirs = @(
    "src/components",
    "src/views",
    "src/panels",
    "src/layouts",
    "src/pages",
    "public",
    "dashboard"
)

foreach ($dir in $criticalDirs) {
    $sourceDir = Join-Path $source $dir
    $destDir = Join-Path $dest $dir
    
    if (Test-Path $sourceDir) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        Copy-Item -Path "$sourceDir\*" -Destination $destDir -Recurse -Force
        Write-Host "   ✅ Sincronizado: $dir" -ForegroundColor Green
    }
}

Write-Host "`n✅ Sincronización completada" -ForegroundColor Green
