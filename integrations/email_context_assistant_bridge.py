"""
EmailContextAssistant Integration Bridge for Adaptive Sales Engine
==================================================================

This module provides seamless integration between EmailContextAssistant
(project intelligence, critical items, stakeholder sentiment tracking)
and Adaptive Sales Engine (sales pipeline, opportunity management, team workflows).

Enables Adaptive Sales Engine to:
1. Auto-import project context from email analysis
2. Track critical items as opportunities/tasks
3. Score emails/leads by relevance to projects
4. Route to appropriate sales owners
5. Monitor stakeholder engagement in real-time

Author: Integration Framework
Date: 2026-09-21
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

# Configuration
EMAILCONTEXTASSISTANT_DATA_PATH = r"C:\Users\isena\Documents\GitHub\EmailContextAssistant\data"
ADAPTIVE_SALES_ENGINE_DATA_PATH = r"C:\Users\isena\Documents\GitHub\adaptive-sales-engine\data"


class EmailContextAssistantBridge:
    """
    Bridge between EmailContextAssistant and Adaptive Sales Engine.
    
    Loads project intelligence from EmailContextAssistant and transforms it
    into Adaptive Sales Engine-compatible format for opportunity tracking,
    lead scoring, and team workflows.
    """
    
    def __init__(self):
        """Initialize the bridge."""
        self.projects_data = None
        self.load_source_data()
    
    def load_source_data(self) -> bool:
        """
        Load project intelligence from EmailContextAssistant source.
        
        Returns:
            bool: True if loaded successfully, False otherwise
        """
        source_file = os.path.join(
            EMAILCONTEXTASSISTANT_DATA_PATH,
            "PROJECTS_INTEGRATION_DATA.json"
        )
        
        if not os.path.exists(source_file):
            print(f"[ERROR] Source file not found: {source_file}")
            return False
        
        try:
            with open(source_file, 'r', encoding='utf-8') as f:
                self.projects_data = json.load(f)
            print(f"[OK] Loaded project intelligence from EmailContextAssistant")
            return True
        except Exception as e:
            print(f"[ERROR] Failed to load source data: {e}")
            return False
    
    def transform_to_opportunities(self) -> List[Dict[str, Any]]:
        """
        Transform EmailContextAssistant projects into Adaptive Sales Engine opportunities.
        
        Returns:
            List of opportunities ready for import
        """
        opportunities = []
        
        for project in self.projects_data.get('projects', []):
            opportunity = {
                "opportunity_id": project.get('project_id'),
                "name": project.get('project_name'),
                "status": self._map_project_status(project.get('status')),
                "stage": self._map_project_stage(project.get('status')),
                "probability": self._calculate_win_probability(project.get('status')),
                "value": self._extract_value(project.get('contract_value')),
                "owner": self._get_primary_owner(project.get('stakeholders', {})),
                "customer": self._get_primary_customer(project.get('stakeholders', {})),
                "created_date": datetime.now().isoformat(),
                "last_update": datetime.now().isoformat(),
                "critical_items_count": len(project.get('critical_items', [])),
                "risk_level": project.get('risk_assessment', {}).get('level'),
                "tags": [project.get('status'), project.get('criticality')],
                "description": f"Email Context: {project.get('project_type', '')}",
                "metadata": {
                    "source": "EmailContextAssistant",
                    "project_type": project.get('project_type'),
                    "location": project.get('location'),
                    "communication_protocol": project.get('communication_protocol', {})
                }
            }
            opportunities.append(opportunity)
        
        return opportunities
    
    def transform_to_tasks(self) -> List[Dict[str, Any]]:
        """
        Transform critical items into Adaptive Sales Engine tasks.
        
        Returns:
            List of tasks ready for assignment
        """
        tasks = []
        
        for project in self.projects_data.get('projects', []):
            for item in project.get('critical_items', []):
                task = {
                    "task_id": item.get('item_id'),
                    "title": item.get('title'),
                    "description": item.get('description'),
                    "project_id": project.get('project_id'),
                    "assigned_to": item.get('owner'),
                    "priority": self._map_priority(item.get('priority')),
                    "status": self._map_task_status(item.get('status')),
                    "due_date": item.get('deadline'),
                    "created_date": datetime.now().isoformat(),
                    "is_blocker": item.get('blocker', False),
                    "impact": item.get('impact'),
                    "tags": [
                        "from_email_context",
                        project.get('project_id'),
                        item.get('priority')
                    ]
                }
                tasks.append(task)
        
        return tasks
    
    def transform_to_leads(self) -> List[Dict[str, Any]]:
        """
        Transform stakeholders into Adaptive Sales Engine leads/contacts.
        
        Returns:
            List of leads ready for engagement tracking
        """
        leads = []
        
        for project in self.projects_data.get('projects', []):
            for role_key, stakeholder in project.get('stakeholders', {}).items():
                if isinstance(stakeholder, dict) and 'name' in stakeholder:
                    lead = {
                        "lead_id": f"{project.get('project_id')}_{role_key}",
                        "name": stakeholder.get('name'),
                        "company": stakeholder.get('company'),
                        "email": stakeholder.get('email'),
                        "role": stakeholder.get('role'),
                        "phone": stakeholder.get('phone', ''),
                        "engagement_score": self._calculate_engagement_score(
                            stakeholder.get('recent_sentiment'),
                            stakeholder.get('sensitivity')
                        ),
                        "sentiment": stakeholder.get('recent_sentiment'),
                        "sensitivity_level": stakeholder.get('sensitivity'),
                        "related_project": project.get('project_id'),
                        "last_contact": stakeholder.get('last_contact'),
                        "tags": [
                            project.get('project_id'),
                            stakeholder.get('sensitivity', '').lower(),
                            stakeholder.get('recent_sentiment', '').lower()
                        ]
                    }
                    leads.append(lead)
        
        return leads
    
    def get_scoring_rules(self) -> Dict[str, Any]:
        """
        Export scoring rules from EmailContextAssistant.
        
        Returns:
            Scoring algorithm for email/lead prioritization
        """
        return self.projects_data.get('scoring_rules', {})
    
    def save_to_ase_format(self, output_dir: str) -> bool:
        """
        Save transformed data in Adaptive Sales Engine format.
        
        Args:
            output_dir: Directory to save files to
        
        Returns:
            bool: True if successful
        """
        os.makedirs(output_dir, exist_ok=True)
        
        try:
            # Save opportunities
            opportunities = self.transform_to_opportunities()
            opps_file = os.path.join(output_dir, "ece_opportunities_from_email_context.json")
            with open(opps_file, 'w', encoding='utf-8') as f:
                json.dump(opportunities, f, indent=2, ensure_ascii=False)
            print(f"[OK] Saved {len(opportunities)} opportunities")
            
            # Save tasks
            tasks = self.transform_to_tasks()
            tasks_file = os.path.join(output_dir, "ece_tasks_from_email_context.json")
            with open(tasks_file, 'w', encoding='utf-8') as f:
                json.dump(tasks, f, indent=2, ensure_ascii=False)
            print(f"[OK] Saved {len(tasks)} tasks")
            
            # Save leads
            leads = self.transform_to_leads()
            leads_file = os.path.join(output_dir, "ece_leads_from_email_context.json")
            with open(leads_file, 'w', encoding='utf-8') as f:
                json.dump(leads, f, indent=2, ensure_ascii=False)
            print(f"[OK] Saved {len(leads)} leads/contacts")
            
            # Save scoring rules
            scoring = self.get_scoring_rules()
            scoring_file = os.path.join(output_dir, "ece_scoring_rules_from_email_context.json")
            with open(scoring_file, 'w', encoding='utf-8') as f:
                json.dump(scoring, f, indent=2, ensure_ascii=False)
            print(f"[OK] Saved scoring algorithm")
            
            return True
        
        except Exception as e:
            print(f"[ERROR] Failed to save data: {e}")
            return False
    
    # Private helper methods
    
    def _map_project_status(self, eca_status: str) -> str:
        """Map EmailContextAssistant project status to ASE opportunity status."""
        mapping = {
            'CONFIDENCE_RECOVERY': 'at_risk',
            'COMMERCIAL_NEGOTIATION': 'negotiation',
            'PENDING_FINAL_ACCEPTANCE': 'proposal_sent',
            'IN PROGRESS': 'active',
            'CLOSED_WON': 'closed_won',
            'CLOSED_LOST': 'closed_lost'
        }
        return mapping.get(eca_status, 'lead')
    
    def _map_project_stage(self, eca_status: str) -> int:
        """Map to sales funnel stage (1-5)."""
        stage_map = {
            'CONFIDENCE_RECOVERY': 2,
            'COMMERCIAL_NEGOTIATION': 3,
            'PENDING_FINAL_ACCEPTANCE': 4,
            'IN PROGRESS': 4,
            'CLOSED_WON': 5,
            'CLOSED_LOST': 1
        }
        return stage_map.get(eca_status, 2)
    
    def _calculate_win_probability(self, status: str) -> float:
        """Calculate win probability based on project status."""
        prob_map = {
            'CONFIDENCE_RECOVERY': 0.30,
            'COMMERCIAL_NEGOTIATION': 0.50,
            'PENDING_FINAL_ACCEPTANCE': 0.80,
            'IN PROGRESS': 0.85
        }
        return prob_map.get(status, 0.20)
    
    def _extract_value(self, contract_value: Any) -> float:
        """Extract numeric value from contract value field."""
        if isinstance(contract_value, (int, float)):
            return float(contract_value)
        if isinstance(contract_value, str):
            # Try to extract number from string like "~480,000 EUR per unit"
            import re
            match = re.search(r'[\d,]+', contract_value.replace(',', ''))
            if match:
                return float(match.group())
        return 0.0
    
    def _get_primary_owner(self, stakeholders: Dict) -> str:
        """Get primary internal owner/sales person."""
        internal_lead = stakeholders.get('internal_lead', {})
        return internal_lead.get('name', 'Unassigned')
    
    def _get_primary_customer(self, stakeholders: Dict) -> str:
        """Get primary customer/decision-maker."""
        primary = stakeholders.get('primary', {})
        return primary.get('name', 'Unknown')
    
    def _map_priority(self, priority: str) -> int:
        """Convert priority to numeric scale (1=low, 5=critical)."""
        priority_map = {
            'LOW': 1,
            'MEDIUM': 2,
            'HIGH': 4,
            'CRITICAL': 5
        }
        return priority_map.get(priority, 3)
    
    def _map_task_status(self, status: str) -> str:
        """Map task status."""
        status_map = {
            'PENDING': 'not_started',
            'IN PROGRESS': 'in_progress',
            'BLOCKED': 'blocked',
            'COMPLETED': 'completed',
            'SCHEDULED': 'scheduled'
        }
        return status_map.get(status, 'not_started')
    
    def _calculate_engagement_score(self, sentiment: str, sensitivity: str) -> float:
        """Calculate engagement score based on sentiment and sensitivity."""
        sentiment_score = {
            'FRUSTRATED': 0.2,
            'CONCERNED': 0.4,
            'NEGOTIATING': 0.6,
            'SATISFIED': 0.9,
            'CRITICAL': 0.95
        }.get(sentiment, 0.5)
        
        sensitivity_multiplier = {
            'LOW': 0.5,
            'MEDIUM': 1.0,
            'HIGH': 1.5,
            'CRITICAL': 2.0,
            'STRATEGIC': 2.0
        }.get(sensitivity, 1.0)
        
        return min(100.0, sentiment_score * sensitivity_multiplier * 100)


def main():
    """Main integration execution."""
    print("=" * 70)
    print("EmailContextAssistant Bridge for Adaptive Sales Engine")
    print("=" * 70)
    print()
    
    # Initialize bridge
    bridge = EmailContextAssistantBridge()
    
    if not bridge.projects_data:
        print("[ERROR] Failed to initialize bridge")
        return
    
    # Save transformed data
    output_dir = os.path.join(ADAPTIVE_SALES_ENGINE_DATA_PATH, "from_email_context")
    print(f"Saving transformed data to: {output_dir}")
    print()
    
    if bridge.save_to_ase_format(output_dir):
        print()
        print("=" * 70)
        print("Integration complete!")
        print("=" * 70)
        print()
        print("Files created in Adaptive Sales Engine data directory:")
        print(f"  - ece_opportunities_from_email_context.json")
        print(f"  - ece_tasks_from_email_context.json")
        print(f"  - ece_leads_from_email_context.json")
        print(f"  - ece_scoring_rules_from_email_context.json")
        print()
        print("Next steps:")
        print("1. Import opportunities into your sales pipeline")
        print("2. Assign tasks to team members")
        print("3. Add leads/contacts to your CRM")
        print("4. Configure email routing using scoring rules")
    else:
        print("[ERROR] Failed to save transformed data")


if __name__ == "__main__":
    main()
