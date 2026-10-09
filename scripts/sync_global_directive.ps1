param(
    [string[]]$RepositoryPaths = @()
)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Canonical = Join-Path $Root 'governance/global_operational_directive.md'
$Agents = Join-Path $Root 'AGENTS.md'
$Copilot = Join-Path $Root '.github/copilot-instructions.md'

if (-not (Test-Path $Canonical)) {
    throw "Missing canonical directive: $Canonical"
}

$defaultTargets = @(
    (Join-Path (Split-Path $Root -Parent) 'ingesite.github.io'),
    (Join-Path (Split-Path $Root -Parent) 'IS-BACKOFFICE'),
    (Join-Path (Split-Path $Root -Parent) 'adaptive-sales-engine'),
    $Root,
    (Join-Path (Split-Path $Root -Parent) 'Digital-Ecosystem-Platform'),
    (Join-Path (Split-Path $Root -Parent) 'Factoty-Simulator')
)

if ($RepositoryPaths.Count -eq 0) {
    $RepositoryPaths = $defaultTargets
}

$bundleFiles = @(
    @{ Source = $Agents; Relative = 'AGENTS.md' },
    @{ Source = $Copilot; Relative = '.github/copilot-instructions.md' },
    @{ Source = $Canonical; Relative = 'governance/global_operational_directive.md' }
)

foreach ($repo in $RepositoryPaths) {
    if (-not (Test-Path $repo)) {
        Write-Host "Skipping missing repository path: $repo"
        continue
    }

    foreach ($file in $bundleFiles) {
        $target = Join-Path $repo $file.Relative
        $targetDir = Split-Path -Parent $target
        if (-not (Test-Path $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        }
        Copy-Item -Path $file.Source -Destination $target -Force
    }

    Write-Host "Synced directive bundle to $repo"
}
