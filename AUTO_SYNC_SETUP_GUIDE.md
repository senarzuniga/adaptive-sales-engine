# EmailContextAssistant Auto-Sync for Adaptive Sales Engine
## Continuous Project Intelligence Synchronization

---

## Overview

The **Email Context Auto-Sync** system enables your Adaptive Sales Engine to automatically collect and integrate all project intelligence from EmailContextAssistant. Instead of manual data entry, the system:

✅ **Automatically monitors** EmailContextAssistant for project updates  
✅ **Continuously syncs** new opportunities, tasks, and leads to ASE  
✅ **Merges intelligently** with existing ASE data (updates, doesn't duplicate)  
✅ **Runs on schedule** (daily at 6 AM) or continuously in background  
✅ **Maintains audit trail** with detailed sync logs  
✅ **Handles conflicts** by preserving EmailContext data as source of truth  

---

## Architecture

```
┌─────────────────────────────────┐
│ EmailContextAssistant           │
│ ├─ PROJECTS_INTEGRATION_DATA.json│
│ ├─ Projects (IP Waterloo, etc)  │
│ ├─ Critical Items               │
│ └─ Stakeholders                 │
└──────────────┬──────────────────┘
               │ (monitor)
               ▼
┌─────────────────────────────────┐
│ EmailContextAutoSync Watcher    │
│ ├─ email_context_auto_sync.py   │
│ ├─ Detects changes              │
│ ├─ Transforms data              │
│ └─ Merges intelligently         │
└──────────────┬──────────────────┘
               │ (sync)
               ▼
┌─────────────────────────────────┐
│ Adaptive Sales Engine           │
│ ├─ opportunities.json           │
│ ├─ tasks.json                   │
│ ├─ contacts.json                │
│ └─ sync_log_emailcontext.txt    │
└─────────────────────────────────┘
```

---

## Installation & Setup

### Prerequisites

- Python 3.7+ installed
- Both repositories available locally:
  - `C:\Users\isena\Documents\GitHub\EmailContextAssistant`
  - `C:\Users\isena\Documents\GitHub\adaptive-sales-engine`
- Windows Task Scheduler access (for scheduled sync)

### Step 1: Verify Files

```powershell
# Verify EmailContextAssistant data file exists
Test-Path "C:\Users\isena\Documents\GitHub\EmailContextAssistant\data\PROJECTS_INTEGRATION_DATA.json"

# Verify bridge module exists
Test-Path "C:\Users\isena\Documents\GitHub\adaptive-sales-engine\integrations\email_context_assistant_bridge.py"
```

### Step 2: Install as Scheduled Task (Automated Daily Sync)

**Run PowerShell as Administrator:**

```powershell
# Navigate to integrations folder
cd "C:\Users\isena\Documents\GitHub\adaptive-sales-engine\integrations"

# Execute scheduling script
.\schedule_auto_sync.ps1
```

This will:
- Create a Windows Task Scheduler task
- Set to run daily at 6:00 AM
- Run immediately to test
- Display sync logs

**Expected Output:**
```
Task created successfully!

Scheduled to run: Daily at 6:00 AM
Status: Ready

Last run time: 2026-09-21 09:15:23

Setup complete!
```

### Step 3: Verify Sync is Working

```powershell
# Check sync logs
Get-Content "C:\Users\isena\Documents\GitHub\adaptive-sales-engine\data\sync_log_emailcontext.txt" -Tail 50
```

---

## Usage Modes

### Mode 1: Scheduled Daily Sync (Recommended)

**Setup:** Run `schedule_auto_sync.ps1` (see Step 2 above)

**How it works:**
- Automatic sync runs every day at 6:00 AM
- Updates ASE with any new/changed EmailContextAssistant data
- Logs all changes to sync_log_emailcontext.txt
- Requires no manual intervention

**Advantages:**
- ✅ Fully automated
- ✅ Runs during off-hours
- ✅ No resource overhead
- ✅ Audit trail maintained

**When to use:** Production deployments, large teams

---

### Mode 2: Run Manually

```powershell
# Navigate to integrations folder
cd "C:\Users\isena\Documents\GitHub\adaptive-sales-engine\integrations"

# Run sync once
python email_context_auto_sync.py
```

**Output:**
```
======================================================================
EmailContextAssistant Auto-Sync Watcher
======================================================================

Starting continuous sync watcher...
Check interval: 5 minutes
Log file: C:\Users\isena\Documents\GitHub\adaptive-sales-engine\data\sync_log_emailcontext.txt

Starting sync cycle...
Loaded ECA data: 3 projects
Loaded ASE data: 9 opportunities
Opportunities: 2 added, 1 updated
Tasks: 3 added, 0 updated
Leads: 1 added, 2 updated
Sync completed: 6 total changes (sync #1)
```

**Advantages:**
- ✅ Immediate control
- ✅ See real-time output
- ✅ Good for testing/debugging

**When to use:** Testing, one-time syncs, manual updates

---

### Mode 3: Background Service (Advanced)

For continuous real-time sync, run in background thread:

```python
from email_context_auto_sync import EmailContextAutoSync

# Create watcher (check every 5 minutes)
watcher = EmailContextAutoSync(check_interval=300)

# Run in background thread (daemon)
thread = watcher.run_in_thread(daemon=True)

# Do other work...
# Thread continues syncing in background

# Stop when done
watcher.stop()
```

**Advantages:**
- ✅ Near real-time updates
- ✅ Seamless integration
- ✅ Programmatic control

**When to use:** API servers, always-on applications

---

## Data Transformation Rules

### Projects → Opportunities

| EmailContext | → | Adaptive Sales Engine |
|---|---|---|
| Project ID | → | opportunity_id |
| Project Name | → | opportunity_name |
| Project Status | → | sales_stage (1-5) |
| Budget | → | estimated_value |
| Confidence Score | → | win_probability |
| Start Date | → | expected_close_date |

**Status Mapping:**
- `CONFIDENCE_RECOVERY` → `at_risk` (stage 2)
- `COMMERCIAL_NEGOTIATION` → `negotiation` (stage 3)
- `APPROVED` → `committed` (stage 4)

---

### Critical Items → Tasks

| EmailContext | → | Adaptive Sales Engine |
|---|---|---|
| Item ID | → | task_id |
| Item Title | → | task_title |
| Item Priority | → | priority (1-5) |
| Owner | → | assigned_to |
| Deadline | → | due_date |
| Blocked By | → | blockers (array) |
| Description | → | description |

**Priority Mapping:**
- CRITICAL (95-100) → 5 (Urgent)
- HIGH (80-94) → 4 (High)
- MEDIUM (60-79) → 3 (Medium)
- LOW (<60) → 2 (Low)

---

### Stakeholders → Leads

| EmailContext | → | Adaptive Sales Engine |
|---|---|---|
| Stakeholder Name | → | lead_name |
| Email | → | email |
| Company | → | company |
| Sentiment Score | → | engagement_score |
| Interaction Count | → | engagement_level |
| Last Contact | → | last_contact_date |

**Engagement Calculation:**
```
engagement_score = (sentiment * 0.4) + (frequency * 0.3) + (criticality * 0.3)
Range: 0-100
```

---

## Sync Log Analysis

All sync events are logged to:
```
C:\Users\isena\Documents\GitHub\adaptive-sales-engine\data\sync_log_emailcontext.txt
```

**Log Format:**
```
[2026-09-21T09:15:23] [INFO] Starting sync cycle...
[2026-09-21T09:15:23] [INFO] Loaded ECA data: 3 projects
[2026-09-21T09:15:23] [INFO] Loaded ASE data: 9 opportunities
[2026-09-21T09:15:24] [INFO] Opportunities: 2 added, 1 updated
[2026-09-21T09:15:24] [INFO] Tasks: 3 added, 0 updated
[2026-09-21T09:15:24] [INFO] Leads: 1 added, 2 updated
[2026-09-21T09:15:25] [INFO] Sync completed: 6 total changes (sync #1)
```

**Common Log Messages:**

| Message | Meaning | Action |
|---|---|---|
| `Starting sync cycle...` | Sync started | Normal |
| `No changes detected` | ECA data unchanged | Normal |
| `Sync completed: N changes` | Successful sync | Normal |
| `ERROR: Source file not found` | ECA file missing | Check EmailContextAssistant repo |
| `Failed to load ECA data` | ECA parsing error | Check JSON format |
| `Failed to save ASE data` | Permission error | Check folder permissions |

---

## Troubleshooting

### Problem: Scheduled task not running

**Check 1:** Verify task exists
```powershell
Get-ScheduledTask -TaskName "EmailContextAssistant-AutoSync"
```

**Check 2:** View task details
```powershell
Get-ScheduledTask -TaskName "EmailContextAssistant-AutoSync" | Get-ScheduledTaskInfo
```

**Check 3:** View last run result
```powershell
Get-ScheduledTask -TaskName "EmailContextAssistant-AutoSync" | Get-ScheduledTaskInfo | Select LastRunTime, LastTaskResult
```

**Solutions:**
- Recreate task: `.\schedule_auto_sync.ps1`
- Run as Administrator if permission denied
- Check Python path: `(Get-Command python).Source`

---

### Problem: "Source file not found" error

**Cause:** EmailContextAssistant PROJECTS_INTEGRATION_DATA.json missing

**Solution:**
```powershell
# Verify file exists in EmailContextAssistant
Test-Path "C:\Users\isena\Documents\GitHub\EmailContextAssistant\data\PROJECTS_INTEGRATION_DATA.json"

# If not, regenerate it from EmailContextAssistant
cd "C:\Users\isena\Documents\GitHub\EmailContextAssistant\data"
python sync_to_adaptive_sales_engine.py
```

---

### Problem: Sync shows "No changes detected" repeatedly

**Cause:** Normal - no new data in EmailContextAssistant since last sync

**Verification:**
```powershell
# Check EmailContextAssistant file timestamp
(Get-Item "C:\Users\isena\Documents\GitHub\EmailContextAssistant\data\PROJECTS_INTEGRATION_DATA.json").LastWriteTime

# Check last sync timestamp
Get-Content "C:\Users\isena\Documents\GitHub\adaptive-sales-engine\data\.emailcontext_last_sync"
```

**Next step:** Add new project intelligence to EmailContextAssistant, then sync will show changes

---

### Problem: "Failed to load ASE data" error

**Cause:** Permissions or corrupted JSON files

**Solutions:**
```powershell
# Check folder permissions
$folder = "C:\Users\isena\Documents\GitHub\adaptive-sales-engine\data"
(Get-Item $folder).GetAccessControl()

# Validate JSON syntax in opportunities.json
python -c "import json; json.load(open('C:\...\adaptive-sales-engine\data\opportunities.json'))"

# Restore from backup if corrupted
Copy-Item "opportunities.json" "opportunities.json.backup"
```

---

## Monitoring & Maintenance

### Daily Checks

```powershell
# View last 10 sync events
Get-Content "C:\Users\isena\Documents\GitHub\adaptive-sales-engine\data\sync_log_emailcontext.txt" -Tail 10

# Check sync health
$log = Get-Content "C:\Users\isena\Documents\GitHub\adaptive-sales-engine\data\sync_log_emailcontext.txt"
$errors = $log | Select-String "ERROR"
if ($errors) { Write-Host "Errors found: $($errors.Count)" } else { Write-Host "No errors detected" }
```

### Weekly Review

```powershell
# Summary of weekly syncs
$log = Get-Content "C:\Users\isena\Documents\GitHub\adaptive-sales-engine\data\sync_log_emailcontext.txt"
$syncs = $log | Select-String "Sync completed"
Write-Host "Total syncs this week: $($syncs.Count)"
Write-Host "Latest: $($syncs[-1])"
```

### Maintenance Tasks

**Every month:**
- Archive old sync logs (keep 90 days)
- Verify no accumulation of duplicate records
- Check for high error rates

**Every quarter:**
- Review scoring algorithm accuracy
- Audit stakeholder engagement calculations
- Performance tune if sync time increasing

---

## API Integration

To integrate auto-sync with your own applications:

```python
from email_context_auto_sync import EmailContextAutoSync

# Create watcher
watcher = EmailContextAutoSync(check_interval=300)

# Perform immediate sync
success = watcher.perform_sync()
if success:
    print(f"Synced: {watcher.sync_count} cycles completed")
    # Load updated data
    opportunities = watcher.ase_data['opportunities']
    tasks = watcher.ase_data['tasks']
    leads = watcher.ase_data['contacts']

# Or run continuously in background
thread = watcher.run_in_thread(daemon=False)
```

---

## FAQ

**Q: How often should I run the sync?**  
A: Daily at 6 AM (default) is sufficient for most teams. High-velocity sales environments may want hourly sync.

**Q: Will sync create duplicates?**  
A: No - sync checks for existing records by ID and updates instead of creating duplicates.

**Q: Can I modify synced data in ASE?**  
A: Yes, but changes will be overwritten on next sync. Modify data in EmailContextAssistant to make permanent changes.

**Q: What if EmailContextAssistant and ASE have conflicting data?**  
A: EmailContextAssistant is the source of truth. ASE changes are overwritten on sync.

**Q: How do I export synced data?**  
A: Use ASE's native export features. Synced data is stored in standard JSON format.

**Q: Can I disable the scheduled task?**  
A: Yes: `Disable-ScheduledTask -TaskName "EmailContextAssistant-AutoSync"`

---

## Support

**Documentation:** See EMAILCONTEXTASSISTANT_INTEGRATION.md for detailed architecture

**Logs Location:** `C:\Users\isena\Documents\GitHub\adaptive-sales-engine\data\sync_log_emailcontext.txt`

**Source Code:** 
- Watcher: `integrations/email_context_auto_sync.py`
- Scheduler: `integrations/schedule_auto_sync.ps1`
- Bridge: `integrations/email_context_assistant_bridge.py`

---

**Last Updated:** 2026-09-21  
**Version:** 1.0  
**Status:** Production Ready
