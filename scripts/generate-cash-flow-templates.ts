import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const template = {
  paymentMilestones: [
    { milestone_number: 1, milestone_title: 'Contract Signature', percentage: 20, expected_days_after_contract: 0 },
    { milestone_number: 2, milestone_title: 'Material Delivery', percentage: 30, expected_days_after_contract: 30 },
    { milestone_number: 3, milestone_title: 'Installation Completion', percentage: 30, expected_days_after_contract: 60 },
    { milestone_number: 4, milestone_title: 'Final Acceptance', percentage: 20, expected_days_after_contract: 90 },
  ],
  costConcepts: [
    {
      concept_name: 'Materials & Equipment',
      total_cost: 50000,
      cost_type: 'direct',
      supplier_payments: [
        { milestone_number: 1, milestone_title: 'Purchase Order', percentage_of_concept: 50, expected_days_after_contract: 0 },
        { milestone_number: 2, milestone_title: 'Before Shipment', percentage_of_concept: 40, expected_days_after_contract: 25 },
        { milestone_number: 3, milestone_title: 'On Delivery', percentage_of_concept: 10, expected_days_after_contract: 30 },
      ],
    },
    {
      concept_name: 'Engineering & Design',
      total_cost: 15000,
      cost_type: 'direct',
      supplier_payments: [
        { milestone_number: 1, milestone_title: 'Kick-off', percentage_of_concept: 30, expected_days_after_contract: 0 },
        { milestone_number: 2, milestone_title: 'Design Review', percentage_of_concept: 40, expected_days_after_contract: 20 },
        { milestone_number: 3, milestone_title: 'Final Delivery', percentage_of_concept: 30, expected_days_after_contract: 45 },
      ],
    },
  ],
};

const targetDir = path.resolve(process.cwd(), 'seeds');
mkdirSync(targetDir, { recursive: true });
const targetFile = path.join(targetDir, 'cash-flow-templates.json');
writeFileSync(targetFile, JSON.stringify({ generatedAt: new Date().toISOString(), template }, null, 2), 'utf-8');

console.log(`Cash flow templates written to ${targetFile}`);
