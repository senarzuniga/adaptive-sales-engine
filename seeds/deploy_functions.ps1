# ============================================================
# Supabase Edge Functions Deployer
# Uses npx so no global Supabase CLI install is required.
# ============================================================
#
# Usage:
#   .\seeds\deploy_functions.ps1 -AccessToken "sbp_xxxx..."
#   .\seeds\deploy_functions.ps1 -AccessToken "sbp_xxxx..." -LovableApiKey "lv_xxxx..."
#
# Notes:
# - If LOVABLE_API_KEY is already set in Supabase project secrets, omit it.
# - This script links the project and deploys all edge functions with JWT verification disabled.
# ============================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$AccessToken = $env:SUPABASE_ACCESS_TOKEN,

    [Parameter(Mandatory=$false)]
    [string]$LovableApiKey = "",

    [Parameter(Mandatory=$false)]
    [string]$ProjectRef = "vrrwvqbnuvkzrlpaejbf"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($AccessToken)) {
    throw 'No Supabase access token found. Set SUPABASE_ACCESS_TOKEN once or pass -AccessToken.'
}

$env:SUPABASE_ACCESS_TOKEN = $AccessToken

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    throw "npx is not available. Install Node.js 20+ and retry."
}

Write-Host "`n[1/4] Checking Supabase CLI..." -ForegroundColor Cyan
Write-Host "  > npx --yes supabase --version" -ForegroundColor DarkGray
& npx --yes supabase --version
if ($LASTEXITCODE -ne 0) { throw "Supabase CLI check failed." }

Write-Host "`n[2/4] Linking project..." -ForegroundColor Cyan
Write-Host ("  > npx --yes supabase link --project-ref {0}" -f $ProjectRef) -ForegroundColor DarkGray
& npx --yes supabase link --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { throw "Supabase project link failed." }

Write-Host "`n[3/4] Setting secrets..." -ForegroundColor Cyan
if ([string]::IsNullOrWhiteSpace($LovableApiKey)) {
    Write-Host "  Using existing LOVABLE_API_KEY project secret" -ForegroundColor Yellow
} else {
    Write-Host ("  > npx --yes supabase secrets set LOVABLE_API_KEY=*** --project-ref {0}" -f $ProjectRef) -ForegroundColor DarkGray
    & npx --yes supabase secrets set ("LOVABLE_API_KEY={0}" -f $LovableApiKey) --project-ref $ProjectRef
    if ($LASTEXITCODE -ne 0) { throw "Supabase secret update failed." }
}

Write-Host "`n[4/4] Deploying Edge Functions..." -ForegroundColor Cyan
$functions = @(
    "process-document",
    "enrich-company",
    "data-api",
    "rebuild-canonical-data",
    "analyze-360",
    "analyze-offer",
    "analyze-portfolio",
    "after-sales-intelligence",
    "project-intelligence",
    "generate-action-content",
    "generate-action-pool",
    "generate-content",
    "generate-weekly-plan",
    "email-cobot",
    "business-intelligence",
    "summarize-notes"
)

foreach ($fn in $functions) {
    Write-Host ("  Deploying {0}..." -f $fn) -ForegroundColor White
    Write-Host ("  > npx --yes supabase functions deploy {0} --project-ref {1} --no-verify-jwt --use-api" -f $fn, $ProjectRef) -ForegroundColor DarkGray
    & npx --yes supabase functions deploy $fn --project-ref $ProjectRef --no-verify-jwt --use-api
    if ($LASTEXITCODE -ne 0) { throw ("Function deployment failed for {0}." -f $fn) }
}

Write-Host "`nDone. Verify functions here:" -ForegroundColor Green
Write-Host ("  https://supabase.com/dashboard/project/{0}/functions" -f $ProjectRef) -ForegroundColor White
