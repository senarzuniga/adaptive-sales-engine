param(
    [switch]$Commit
)

$targets = @(
    'Adaptive Sales Engine - Lovable_files/',
    '"Adaptive Sales Engine - Lovable.html"',
    'dist',
    'public',
    'Adaptive Sales Engine - Lovable.html'
)

Write-Host "Targets to untrack:"
$targets | ForEach-Object { Write-Host " - $_" }

foreach ($t in $targets) {
    Write-Host "Checking: $t"
    # If git is available, untrack the path but keep local copy
    if (Get-Command git -ErrorAction SilentlyContinue) {
        git rm --cached -r --ignore-unmatch $t
    } else {
        Write-Host "git not found; run: git rm --cached -r --ignore-unmatch $t"
    }
}

if ($Commit) {
    if (Get-Command git -ErrorAction SilentlyContinue) {
        git add -A
        git commit -m "chore: remove checked-in build artifacts and update .gitignore"
    } else {
        Write-Host "git not found; please commit the changes manually."
    }
}

Write-Host "Done. Inspect 'git status' for remaining changes."
