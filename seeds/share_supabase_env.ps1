param(
    [Parameter(Mandatory=$false)]
    [string[]]$Targets = @('.', 'adaptive-sales-engine')
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$SourceEnv = Join-Path $RepoRoot '.env'

if (-not (Test-Path $SourceEnv)) {
    throw "Root .env not found at $SourceEnv"
}

$values = @{}
Get-Content $SourceEnv | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#') -or -not $line.Contains('=')) {
        return
    }

    $name, $value = $line -split '=', 2
    $name = $name.Trim()
    $value = $value.Trim().Trim('"').Trim("'")

    if ($name -in @('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_PROJECT_ID')) {
        $values[$name] = $value
    }
}

if (-not $values.ContainsKey('VITE_SUPABASE_PROJECT_ID') -and $values.ContainsKey('VITE_SUPABASE_URL')) {
    if ($values['VITE_SUPABASE_URL'] -match 'https://([^.]+)\.supabase\.co') {
        $values['VITE_SUPABASE_PROJECT_ID'] = $Matches[1]
    }
}

if (-not $values.ContainsKey('VITE_SUPABASE_URL') -or -not $values.ContainsKey('VITE_SUPABASE_PUBLISHABLE_KEY')) {
    throw 'Root .env must contain VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY'
}

$content = @(
    '# Auto-generated from the repository root .env',
    '# Run seeds/share_supabase_env.ps1 to refresh these values',
    "VITE_SUPABASE_PROJECT_ID=$($values['VITE_SUPABASE_PROJECT_ID'])",
    "VITE_SUPABASE_URL=$($values['VITE_SUPABASE_URL'])",
    "VITE_SUPABASE_PUBLISHABLE_KEY=$($values['VITE_SUPABASE_PUBLISHABLE_KEY'])"
)

foreach ($target in $Targets) {
    $targetPath = if ([System.IO.Path]::IsPathRooted($target)) { $target } else { Join-Path $RepoRoot $target }

    if (-not (Test-Path $targetPath)) {
        Write-Host ("SKIP {0} - folder not found" -f $targetPath) -ForegroundColor Yellow
        continue
    }

    $dest = Join-Path $targetPath '.env.local'
    Set-Content -Path $dest -Value $content -Encoding UTF8
    Write-Host ("Synced Supabase env to {0}" -f $dest) -ForegroundColor Green
}

Write-Host 'Done. Other applications can now reuse the same Supabase client settings without manual copy-paste.' -ForegroundColor Cyan
