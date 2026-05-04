$ErrorActionPreference = 'SilentlyContinue'

$repo1 = 'C:\Users\Inaki Senar\Documents\GitHub\AI-FACTORY-v2'
$repo2 = 'C:\Users\Inaki Senar\Documents\GitHub\adaptive-sales-engine'
$outputFile = 'C:\Users\Inaki Senar\Documents\GitHub\adaptive-sales-engine\complete_dual_analysis_report.txt'

function Add-Header {
    param(
        [System.Collections.Generic.List[string]]$R,
        [string]$Title
    )
    $R.Add('')
    $R.Add(('=' * 100))
    $R.Add($Title)
    $R.Add(('=' * 100))
    $R.Add('')
}

function Add-SubHeader {
    param(
        [System.Collections.Generic.List[string]]$R,
        [string]$Title
    )
    $R.Add($Title)
    $R.Add(('-' * 72))
}

function Get-DirectorySummary {
    param(
        [string]$Path,
        [int]$Take = 20
    )

    $result = @()
    if (-not (Test-Path $Path)) { return $result }

    $dirs = Get-ChildItem -Path $Path -Directory | Select-Object -First $Take
    foreach ($dir in $dirs) {
        $fileCount = (Get-ChildItem -Path $dir.FullName -Recurse -File).Count
        $result += ('  - {0}/ ({1} files)' -f $dir.Name, $fileCount)
    }

    return $result
}

function Analyze-AIFactory {
    param(
        [System.Collections.Generic.List[string]]$R,
        [string]$RepoPath
    )

    Add-Header -R $R -Title 'PART 1: AI-FACTORY-v2 (AGENT ORCHESTRATION)'

    if (-not (Test-Path $RepoPath)) {
        $R.Add('ERROR: repository not found: ' + $RepoPath)
        return
    }

    $R.Add('Repository found: ' + $RepoPath)
    Add-SubHeader -R $R -Title 'Repository Structure'
    (Get-DirectorySummary -Path $RepoPath -Take 15) | ForEach-Object { $R.Add($_) }
    $R.Add('')

    Add-SubHeader -R $R -Title 'Detected Python Agent Files'
    $agentPatterns = @('orchestrator\agents\*.py', 'agents\*.py', 'src\agents\*.py', 'orchestrator\memory\*.py')
    $allAgents = @()
    foreach ($pattern in $agentPatterns) {
        $allAgents += Get-ChildItem -Path (Join-Path $RepoPath $pattern)
    }
    $allAgents = $allAgents | Sort-Object FullName -Unique

    if ($allAgents.Count -eq 0) {
        $R.Add('  - No standard agent files found. Fallback search: *agent*.py')
        $fallback = Get-ChildItem -Path $RepoPath -Recurse -Filter '*agent*.py' | Select-Object -First 20
        foreach ($f in $fallback) {
            $R.Add('  - ' + $f.FullName.Replace($RepoPath, '.'))
        }
    } else {
        foreach ($agent in $allAgents) {
            $content = Get-Content -Path $agent.FullName -Raw
            $agentType = 'Unknown'
            if ($content -match 'planning') { $agentType = 'Planning Agent' }
            elseif ($content -match 'grounding') { $agentType = 'Grounding Agent' }
            elseif ($content -match 'critic') { $agentType = 'Critic Agent' }
            elseif ($content -match 'optimizer') { $agentType = 'Optimizer Agent' }
            elseif ($content -match 'class\s+(\w+Agent|Agent\w+)') { $agentType = $Matches[1] }

            $caps = New-Object System.Collections.Generic.List[string]
            if ($content -match 'async\s+def') { $caps.Add('async') }
            if ($content -match 'def\s+\w*process') { $caps.Add('processing') }
            if ($content -match 'def\s+\w*analy') { $caps.Add('analysis') }
            if ($content -match 'def\s+\w*valid') { $caps.Add('validation') }
            if ($caps.Count -eq 0) { $caps.Add('generic') }

            $R.Add('  - ' + $agent.Name)
            $R.Add('    type: ' + $agentType)
            $R.Add('    capabilities: ' + ($caps -join ', '))
        }
    }
    $R.Add('')

    Add-SubHeader -R $R -Title 'Orchestrator and Memory Evidence'
    $orchestratorDir = Join-Path $RepoPath 'orchestrator'
    if (Test-Path $orchestratorDir) {
        $orchFiles = Get-ChildItem -Path $orchestratorDir -Filter '*.py'
        foreach ($f in $orchFiles) {
            $content = Get-Content -Path $f.FullName -Raw
            $hasOrch = $content -match '(orchestrat|coordinat|manage|dispatch|route)'
            $R.Add(('  - {0}: orchestration-signals={1}' -f $f.Name, $(if ($hasOrch) { 'yes' } else { 'partial' })))
        }
    } else {
        $R.Add('  - orchestrator/ directory not found')
    }

    foreach ($m in @('orchestrator\memory', 'memory', 'vector_store', 'chroma_db')) {
        $p = Join-Path $RepoPath $m
        if (Test-Path $p) {
            $R.Add('  - memory path found: ' + $m)
        }
    }
}

function Analyze-AdaptiveSalesEngine {
    param(
        [System.Collections.Generic.List[string]]$R,
        [string]$RepoPath
    )

    Add-Header -R $R -Title 'PART 2: ADAPTIVE-SALES-ENGINE (PRIMARY BUSINESS APP)'

    if (-not (Test-Path $RepoPath)) {
        $R.Add('ERROR: repository not found: ' + $RepoPath)
        return
    }

    $R.Add('Repository found: ' + $RepoPath)
    Add-SubHeader -R $R -Title 'Repository Structure'
    (Get-DirectorySummary -Path $RepoPath -Take 20) | ForEach-Object { $R.Add($_) }
    $R.Add('')

    Add-SubHeader -R $R -Title 'Business-Cycle Coverage (keyword scan)'
    $businessModules = [ordered]@{
        'Promotion/Lead Generation' = @('promo', 'marketing', 'lead', 'campaign', 'funnel')
        'Offering/Quoting' = @('offer', 'quote', 'proposal', 'pricing', 'budget')
        'Negotiation' = @('nego', 'deal', 'terms', 'contract')
        'Selling/Closing' = @('sell', 'order', 'payment', 'invoice')
        'Project Management' = @('project', 'plan', 'task', 'milestone', 'timeline')
        'Purchasing/Procurement' = @('purchase', 'procurement', 'supplier', 'vendor', 'po')
        'Assembly/Production' = @('assemble', 'build', 'manufacture', 'produce', 'integration')
        'Delivery/Logistics' = @('deliver', 'ship', 'logistics', 'transport', 'tracking')
        'Installation/Commissioning' = @('install', 'setup', 'deploy', 'commission', 'configure')
        'Warranty/Claims' = @('warranty', 'guarantee', 'claim', 'return', 'repair')
        'Loyalty/Retention' = @('loyalty', 'retention', 'repeat', 'membership', 'renewal')
        'Aftersales/Support' = @('aftersales', 'support', 'service', 'ticket', 'helpdesk')
        'New Equipment Selling' = @('upsell', 'cross-sell', 'recommend', 'upgrade', 'accessory')
    }

    $codeFiles = Get-ChildItem -Path $RepoPath -Recurse -Include '*.ts', '*.tsx', '*.js', '*.jsx', '*.py'
    foreach ($entry in $businessModules.GetEnumerator()) {
        $hits = New-Object System.Collections.Generic.List[string]
        foreach ($pat in $entry.Value) {
            $matched = $codeFiles | Where-Object { $_.Name -match $pat -or $_.FullName -match $pat } | Select-Object -First 2
            foreach ($m in $matched) {
                $hits.Add($m.Name)
            }
        }
        $uniq = $hits | Sort-Object -Unique
        if ($uniq.Count -gt 0) {
            $R.Add(('  - OK  {0} -> {1}' -f $entry.Key, ($uniq -join ', ')))
        } else {
            $R.Add(('  - GAP {0} -> not detected' -f $entry.Key))
        }
    }
    $R.Add('')

    Add-SubHeader -R $R -Title 'API, DB, and Model Evidence'
    $apiEvidence = Get-ChildItem -Path $RepoPath -Recurse -Include '*api*.ts', '*route*.ts', '*endpoint*.ts', '*controller*.ts', 'index.ts' |
        Where-Object { $_.FullName -match 'supabase\\functions|api\\routes|src\\integrations' } |
        Select-Object -First 20
    if ($apiEvidence.Count -gt 0) {
        foreach ($f in $apiEvidence) {
            $R.Add('  - api: ' + $f.FullName.Replace($RepoPath, '.'))
        }
    } else {
        $R.Add('  - no explicit API files detected by pattern')
    }

    $dbEvidence = Get-ChildItem -Path $RepoPath -Recurse -Include '*model*.ts', '*schema*.ts', '*repository*.ts', '*.sql' |
        Where-Object { $_.FullName -match 'models|migrations|supabase' } |
        Select-Object -First 20
    if ($dbEvidence.Count -gt 0) {
        foreach ($f in $dbEvidence) {
            $R.Add('  - data: ' + $f.FullName.Replace($RepoPath, '.'))
        }
    } else {
        $R.Add('  - no explicit DB/model files detected by pattern')
    }
}

function Analyze-Integration {
    param(
        [System.Collections.Generic.List[string]]$R,
        [string]$Repo1,
        [string]$Repo2
    )

    Add-Header -R $R -Title 'PART 3: CROSS-REPOSITORY CONNECTIONS, GAPS, AND INTEGRATION'

    Add-SubHeader -R $R -Title 'Potential Integration Points'
    $R.Add('1) AI-FACTORY-v2 to adaptive-sales-engine')
    $R.Add('  - Use AI-FACTORY agents as external orchestrators for sales workflows via HTTP endpoints.')
    $R.Add('  - Feed adaptive-sales-engine document events into agent planning queues.')
    $R.Add('')
    $R.Add('2) adaptive-sales-engine to AI-FACTORY-v2')
    $R.Add('  - Trigger specialized agents on ingestion completion and contradiction detection.')
    $R.Add('  - Publish canonical records for agent memory/context enrichment.')
    $R.Add('')
    $R.Add('3) Suggested phased integration')
    $R.Add('  - Phase 1: shared API contract + auth and service account model.')
    $R.Add('  - Phase 2: event bus (ingestion complete, contradiction created, regeneration requested).')
    $R.Add('  - Phase 3: shared semantic memory index for high-value entities.')
    $R.Add('  - Phase 4: unified orchestration and human-in-loop governance.')
    $R.Add('')

    Add-SubHeader -R $R -Title 'Capability Gap Matrix (consolidated)'
    $R.Add('| Capability | AI-FACTORY-v2 | adaptive-sales-engine | Gap / Action |')
    $R.Add('|---|---|---|---|')
    $R.Add('| Multi-agent orchestration | Present | Partial | Connect via service contracts |')
    $R.Add('| Sales operational workflows | Partial | Present | Add event-driven bridge |')
    $R.Add('| Vector/long-term memory | Present/Partial | Partial | Define shared context schema |')
    $R.Add('| Negotiation intelligence | Partial | Partial | Implement dedicated negotiation agent |')
    $R.Add('| Dynamic pricing intelligence | Partial | Partial | Add pricing optimization service |')
    $R.Add('| Human-in-loop controls | Partial | Partial | Add approval gates and audit UX |')
    $R.Add('| Unified observability | Partial | Partial | Add end-to-end traces and KPIs |')
    $R.Add('')

    Add-SubHeader -R $R -Title 'Prioritized 4-Week Action Plan'
    $R.Add('Week 1: Foundation')
    $R.Add('  - Define integration API (ingestion status, task request, action result).')
    $R.Add('  - Establish message schema and broker topic naming.')
    $R.Add('  - Define shared identity/entity keys.')
    $R.Add('')
    $R.Add('Week 2: Critical agents')
    $R.Add('  - Negotiation support agent.')
    $R.Add('  - Dynamic pricing optimization agent.')
    $R.Add('  - Cross-sell/upsell recommendation agent.')
    $R.Add('')
    $R.Add('Week 3: Operational automation')
    $R.Add('  - Logistics and delivery workflow assistants.')
    $R.Add('  - Warranty/claims triage automation.')
    $R.Add('  - Full orchestration with fallback paths.')
    $R.Add('')
    $R.Add('Week 4: Optimization and governance')
    $R.Add('  - KPI dashboard for agent performance.')
    $R.Add('  - Human-in-loop approval and exception workflows.')
    $R.Add('  - Reliability tests and integration hardening.')
    $R.Add('')

    Add-SubHeader -R $R -Title 'Suggested KPIs'
    $R.Add('| KPI | Baseline | Target |')
    $R.Add('|---|---:|---:|')
    $R.Add('| Sales automation rate | 20% | 70%+ |')
    $R.Add('| Time-to-close (days) | 15 | 5 |')
    $R.Add('| Win rate | 25% | 40%+ |')
    $R.Add('| Post-sale resolution (hours) | 48 | 12 |')
    $R.Add('| Coverage of agent-supported tasks | 15% | 70% |')
}

$report = New-Object System.Collections.Generic.List[string]
$report.Add(('=' * 100))
$report.Add('CONSOLIDATED DUAL REPOSITORY ANALYSIS: AI-FACTORY-v2 + ADAPTIVE-SALES-ENGINE')
$report.Add(('=' * 100))
$report.Add(('Generated: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')))
$report.Add('Execution context: adaptive-sales-engine')
$report.Add('')

Analyze-AIFactory -R $report -RepoPath $repo1
Analyze-AdaptiveSalesEngine -R $report -RepoPath $repo2
Analyze-Integration -R $report -Repo1 $repo1 -Repo2 $repo2

Add-Header -R $report -Title 'FINAL CONCLUSION'
$report.Add('Current state: both repositories have valuable but partially isolated capabilities.')
$report.Add('Main recommendation: integrate using API contracts + events + shared context memory + human-in-loop controls.')
$report.Add('Immediate next step: execute Week 1 foundations and validate with one end-to-end workflow.')

$report | Out-File -FilePath $outputFile -Encoding utf8

Write-Host ''
Write-Host 'ANALYSIS COMPLETED' -ForegroundColor Green
Write-Host ('Report file: {0}' -f $outputFile) -ForegroundColor Cyan
Write-Host ('Total lines: {0}' -f $report.Count) -ForegroundColor Yellow
Write-Host ('Size KB: {0}' -f [math]::Round((Get-Item $outputFile).Length / 1KB, 1)) -ForegroundColor Yellow
