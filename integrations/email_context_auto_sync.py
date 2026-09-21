"""
Continuous Auto-Sync Watcher for EmailContextAssistant Integration
===================================================================

This module continuously monitors EmailContextAssistant for project updates
and automatically syncs them into Adaptive Sales Engine data.

Runs as a background service to:
1. Monitor EmailContextAssistant project changes
2. Transform new/updated data to ASE format
3. Merge with existing ASE projects
4. Update ASE data files automatically
5. Log all changes for audit trail

Author: Integration Framework
Date: 2026-09-21
"""

import json
import os
import time
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional
import threading

# Configuration
EMAILCONTEXTASSISTANT_DATA_PATH = r"C:\Users\isena\Documents\GitHub\EmailContextAssistant\data"
ADAPTIVE_SALES_ENGINE_DATA_PATH = r"C:\Users\isena\Documents\GitHub\adaptive-sales-engine\data"
ASE_PROJECTS_FILE = os.path.join(ADAPTIVE_SALES_ENGINE_DATA_PATH, "projects.json")
ASE_OPPORTUNITIES_FILE = os.path.join(ADAPTIVE_SALES_ENGINE_DATA_PATH, "opportunities.json")
ASE_TASKS_FILE = os.path.join(ADAPTIVE_SALES_ENGINE_DATA_PATH, "tasks.json")
ASE_CONTACTS_FILE = os.path.join(ADAPTIVE_SALES_ENGINE_DATA_PATH, "contacts.json")
SYNC_LOG_FILE = os.path.join(ADAPTIVE_SALES_ENGINE_DATA_PATH, "sync_log_emailcontext.txt")
LAST_SYNC_FILE = os.path.join(ADAPTIVE_SALES_ENGINE_DATA_PATH, ".emailcontext_last_sync")


class EmailContextAutoSync:
    """
    Automatic sync watcher between EmailContextAssistant and Adaptive Sales Engine.
    Continuously monitors for changes and syncs to ASE data files.
    """
    
    def __init__(self, check_interval: int = 300):
        """
        Initialize auto-sync watcher.
        
        Args:
            check_interval: Seconds between checks (default 5 minutes)
        """
        self.check_interval = check_interval
        self.last_sync = self._load_last_sync_timestamp()
        self.eca_data = None
        self.ase_data = {}
        self.sync_count = 0
        self.is_running = False
    
    def _load_last_sync_timestamp(self) -> datetime:
        """Load timestamp of last successful sync."""
        if os.path.exists(LAST_SYNC_FILE):
            try:
                with open(LAST_SYNC_FILE, 'r') as f:
                    timestamp_str = f.read().strip()
                    return datetime.fromisoformat(timestamp_str)
            except:
                pass
        return datetime.now() - timedelta(days=1)
    
    def _save_last_sync_timestamp(self):
        """Save current sync timestamp."""
        with open(LAST_SYNC_FILE, 'w') as f:
            f.write(datetime.now().isoformat())
    
    def _log_sync(self, message: str, level: str = "INFO"):
        """Log sync event."""
        timestamp = datetime.now().isoformat()
        log_entry = f"[{timestamp}] [{level}] {message}\n"
        
        with open(SYNC_LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(log_entry)
        
        print(f"{level}: {message}")
    
    def _load_eca_data(self) -> bool:
        """Load EmailContextAssistant project data."""
        source_file = os.path.join(
            EMAILCONTEXTASSISTANT_DATA_PATH,
            "PROJECTS_INTEGRATION_DATA.json"
        )
        
        if not os.path.exists(source_file):
            self._log_sync(f"Source file not found: {source_file}", "ERROR")
            return False
        
        try:
            with open(source_file, 'r', encoding='utf-8') as f:
                self.eca_data = json.load(f)
            self._log_sync(f"Loaded ECA data: {len(self.eca_data.get('projects', []))} projects")
            return True
        except Exception as e:
            self._log_sync(f"Failed to load ECA data: {e}", "ERROR")
            return False
    
    def _load_ase_data(self):
        """Load existing ASE data files."""
        try:
            # Load projects
            if os.path.exists(ASE_PROJECTS_FILE):
                with open(ASE_PROJECTS_FILE, 'r', encoding='utf-8') as f:
                    self.ase_data['projects'] = json.load(f)
            else:
                self.ase_data['projects'] = []
            
            # Load opportunities
            if os.path.exists(ASE_OPPORTUNITIES_FILE):
                with open(ASE_OPPORTUNITIES_FILE, 'r', encoding='utf-8') as f:
                    self.ase_data['opportunities'] = json.load(f)
            else:
                self.ase_data['opportunities'] = []
            
            # Load tasks
            if os.path.exists(ASE_TASKS_FILE):
                with open(ASE_TASKS_FILE, 'r', encoding='utf-8') as f:
                    self.ase_data['tasks'] = json.load(f)
            else:
                self.ase_data['tasks'] = []
            
            # Load contacts
            if os.path.exists(ASE_CONTACTS_FILE):
                with open(ASE_CONTACTS_FILE, 'r', encoding='utf-8') as f:
                    self.ase_data['contacts'] = json.load(f)
            else:
                self.ase_data['contacts'] = []
            
            self._log_sync(f"Loaded ASE data: {len(self.ase_data.get('opportunities', []))} opportunities")
            return True
        except Exception as e:
            self._log_sync(f"Failed to load ASE data: {e}", "ERROR")
            return False
    
    def _merge_opportunities(self):
        """Merge ECA projects as opportunities into ASE."""
        from email_context_assistant_bridge import EmailContextAssistantBridge
        
        bridge = EmailContextAssistantBridge()
        bridge.projects_data = self.eca_data
        
        new_opps = bridge.transform_to_opportunities()
        existing_ids = set(o.get('opportunity_id') for o in self.ase_data.get('opportunities', []))
        
        added = 0
        updated = 0
        
        for opp in new_opps:
            opp_id = opp.get('opportunity_id')
            
            # Check if exists
            existing_idx = next(
                (i for i, o in enumerate(self.ase_data['opportunities']) 
                 if o.get('opportunity_id') == opp_id),
                None
            )
            
            if existing_idx is not None:
                # Update existing
                self.ase_data['opportunities'][existing_idx] = opp
                updated += 1
            else:
                # Add new
                self.ase_data['opportunities'].append(opp)
                added += 1
        
        if added > 0 or updated > 0:
            self._log_sync(f"Opportunities: {added} added, {updated} updated")
        
        return added + updated
    
    def _merge_tasks(self):
        """Merge ECA critical items as tasks into ASE."""
        from email_context_assistant_bridge import EmailContextAssistantBridge
        
        bridge = EmailContextAssistantBridge()
        bridge.projects_data = self.eca_data
        
        new_tasks = bridge.transform_to_tasks()
        existing_ids = set(t.get('task_id') for t in self.ase_data.get('tasks', []))
        
        added = 0
        updated = 0
        
        for task in new_tasks:
            task_id = task.get('task_id')
            
            # Check if exists
            existing_idx = next(
                (i for i, t in enumerate(self.ase_data['tasks']) 
                 if t.get('task_id') == task_id),
                None
            )
            
            if existing_idx is not None:
                # Update existing
                self.ase_data['tasks'][existing_idx] = task
                updated += 1
            else:
                # Add new
                self.ase_data['tasks'].append(task)
                added += 1
        
        if added > 0 or updated > 0:
            self._log_sync(f"Tasks: {added} added, {updated} updated")
        
        return added + updated
    
    def _merge_leads(self):
        """Merge ECA stakeholders as leads into ASE."""
        from email_context_assistant_bridge import EmailContextAssistantBridge
        
        bridge = EmailContextAssistantBridge()
        bridge.projects_data = self.eca_data
        
        new_leads = bridge.transform_to_leads()
        existing_ids = set(l.get('lead_id') for l in self.ase_data.get('contacts', []))
        
        added = 0
        updated = 0
        
        for lead in new_leads:
            lead_id = lead.get('lead_id')
            
            # Check if exists
            existing_idx = next(
                (i for i, l in enumerate(self.ase_data['contacts']) 
                 if l.get('lead_id') == lead_id),
                None
            )
            
            if existing_idx is not None:
                # Update existing
                self.ase_data['contacts'][existing_idx] = lead
                updated += 1
            else:
                # Add new
                self.ase_data['contacts'].append(lead)
                added += 1
        
        if added > 0 or updated > 0:
            self._log_sync(f"Leads: {added} added, {updated} updated")
        
        return added + updated
    
    def _save_ase_data(self):
        """Save updated ASE data files."""
        try:
            os.makedirs(ADAPTIVE_SALES_ENGINE_DATA_PATH, exist_ok=True)
            
            # Save opportunities
            with open(ASE_OPPORTUNITIES_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.ase_data.get('opportunities', []), f, indent=2, ensure_ascii=False)
            
            # Save tasks
            with open(ASE_TASKS_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.ase_data.get('tasks', []), f, indent=2, ensure_ascii=False)
            
            # Save contacts
            with open(ASE_CONTACTS_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.ase_data.get('contacts', []), f, indent=2, ensure_ascii=False)
            
            self._save_last_sync_timestamp()
            return True
        except Exception as e:
            self._log_sync(f"Failed to save ASE data: {e}", "ERROR")
            return False
    
    def perform_sync(self) -> bool:
        """
        Perform one complete sync cycle.
        
        Returns:
            bool: True if sync successful
        """
        self._log_sync("Starting sync cycle...")
        
        # Load data
        if not self._load_eca_data():
            return False
        
        if not self._load_ase_data():
            return False
        
        # Merge data
        opp_changes = self._merge_opportunities()
        task_changes = self._merge_tasks()
        lead_changes = self._merge_leads()
        
        total_changes = opp_changes + task_changes + lead_changes
        
        if total_changes > 0:
            # Save updated data
            if self._save_ase_data():
                self.sync_count += 1
                self._log_sync(f"Sync completed: {total_changes} total changes (sync #{self.sync_count})")
                return True
        else:
            self._log_sync("No changes detected")
            self._save_last_sync_timestamp()
            return True
        
        return False
    
    def run_continuous(self, duration_minutes: Optional[int] = None):
        """
        Run continuous sync in background.
        
        Args:
            duration_minutes: Run for N minutes (None = infinite)
        """
        self.is_running = True
        start_time = datetime.now()
        
        self._log_sync(f"Starting continuous sync watcher (interval: {self.check_interval}s)")
        
        try:
            while self.is_running:
                # Check if time limit reached
                if duration_minutes:
                    elapsed = (datetime.now() - start_time).total_seconds() / 60
                    if elapsed >= duration_minutes:
                        self._log_sync(f"Duration limit reached ({duration_minutes}m), stopping...")
                        break
                
                # Perform sync
                self.perform_sync()
                
                # Wait before next check
                time.sleep(self.check_interval)
        
        except KeyboardInterrupt:
            self._log_sync("Sync watcher interrupted by user")
        except Exception as e:
            self._log_sync(f"Sync watcher error: {e}", "ERROR")
        finally:
            self.is_running = False
            self._log_sync("Sync watcher stopped")
    
    def run_in_thread(self, daemon: bool = True) -> threading.Thread:
        """
        Run sync in background thread.
        
        Args:
            daemon: Run as daemon thread (default True)
        
        Returns:
            Thread object
        """
        thread = threading.Thread(target=self.run_continuous, daemon=daemon)
        thread.start()
        self._log_sync("Sync watcher started in background thread")
        return thread
    
    def stop(self):
        """Stop the watcher."""
        self.is_running = False
        self._log_sync("Stop signal sent to sync watcher")


def main():
    """Main execution - run continuous sync."""
    print("=" * 70)
    print("EmailContextAssistant Auto-Sync Watcher")
    print("=" * 70)
    print()
    print("Starting continuous sync watcher...")
    print(f"Check interval: 5 minutes")
    print(f"Log file: {SYNC_LOG_FILE}")
    print()
    
    watcher = EmailContextAutoSync(check_interval=300)  # 5 minutes
    
    # Run continuously
    watcher.run_continuous()


if __name__ == "__main__":
    main()
