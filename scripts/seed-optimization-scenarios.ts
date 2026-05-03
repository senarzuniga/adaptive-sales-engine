import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const scenarios = [
  {
    id: 'front-load-client-payments',
    name: 'Front-Load Client Payments',
    impact: 'positive',
    description: 'Increase early client milestones and reduce retention concentration.',
    changes: ['H1 +15%', 'H2 +5%', 'H3 -5%', 'H4 -15%'],
  },
  {
    id: 'payment-alignment-strategy',
    name: 'Payment Alignment Strategy',
    impact: 'positive',
    description: 'Shift supplier due dates to align with client inflows.',
    changes: ['Negotiate net-60 for materials', 'Move engineering settlements after H2'],
  },
  {
    id: 'milestone-consolidation',
    name: 'Milestone Consolidation',
    impact: 'positive',
    description: 'Consolidate mid-project milestones to reduce administrative overhead and improve inflow timing.',
    changes: ['Merge H2 + H3', 'Lower final retention'],
  },
  {
    id: 'early-payment-discount-program',
    name: 'Early Payment Discount Program',
    impact: 'positive',
    description: 'Offer small discount incentives for accelerated payment.',
    changes: ['2% discount on early H2', '1% discount on on-time H3'],
  },
  {
    id: 'supplier-financing-program',
    name: 'Supplier Financing Program',
    impact: 'positive',
    description: 'Use supplier credit lines and financing structures to reduce cash gap.',
    changes: ['Enable net-60 suppliers', 'Use reverse factoring'],
  },
];

const targetDir = path.resolve(process.cwd(), 'seeds');
mkdirSync(targetDir, { recursive: true });
const targetFile = path.join(targetDir, 'cash-flow-optimization-scenarios.json');
writeFileSync(targetFile, JSON.stringify({ generatedAt: new Date().toISOString(), scenarios }, null, 2), 'utf-8');

console.log(`Optimization scenarios written to ${targetFile}`);
