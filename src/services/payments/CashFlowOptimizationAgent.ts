import type { CashFlowData } from '@/services/payments/CashFlowGenerator';

export interface OptimizationScenario {
  id: string;
  name: string;
  icon: string;
  impact: 'positive' | 'tradeoff';
  description: string;
  changes: string[];
  projected_peak_negative: number;
  projected_break_even: number;
  financing_saved: number;
  implementation_ease: 'low' | 'medium' | 'high';
  requires_negotiation: 'low' | 'medium' | 'high';
  confidence_score: number;
}

export class CashFlowOptimizationAgent {
  generateOptimizationScenarios(currentCashFlow: CashFlowData): OptimizationScenario[] {
    const baselinePeak = currentCashFlow.metrics.max_financing_needed;
    const baselineBreakEven = Math.max(0, currentCashFlow.metrics.break_even_day);

    const templates: Array<Omit<OptimizationScenario, 'projected_peak_negative' | 'projected_break_even' | 'financing_saved'>> = [
      {
        id: 'front-load-client-payments',
        name: 'Front-Load Client Payments',
        icon: '💰',
        impact: 'positive',
        description: 'Increase advance payment and reduce final retention amount to improve initial cash balance.',
        changes: [
          'H1 Contract Signature: +15%',
          'H2 Material Delivery: +5%',
          'H3 Installation: -5%',
          'H4 Final Acceptance: -15%',
        ],
        implementation_ease: 'high',
        requires_negotiation: 'medium',
        confidence_score: 0.84,
      },
      {
        id: 'payment-alignment-strategy',
        name: 'Payment Alignment Strategy',
        icon: '🔄',
        impact: 'positive',
        description: 'Match supplier due dates with client milestones to avoid temporary liquidity deficits.',
        changes: [
          'Move major supplier terms to net-60',
          'Shift engineering payouts to post-H2 collection',
          'Link acceptance triggers with client milestone releases',
        ],
        implementation_ease: 'medium',
        requires_negotiation: 'high',
        confidence_score: 0.76,
      },
      {
        id: 'milestone-consolidation',
        name: 'Milestone Consolidation',
        icon: '📊',
        impact: 'positive',
        description: 'Reduce fragmented milestones and consolidate mid-project billing to improve net position.',
        changes: [
          'Merge H2 and H3 into one milestone',
          'Decrease tail-end payment concentration',
          'Introduce long-lead procurement trigger milestone',
        ],
        implementation_ease: 'high',
        requires_negotiation: 'low',
        confidence_score: 0.82,
      },
      {
        id: 'early-payment-discount-program',
        name: 'Early Payment Discount Program',
        icon: '🏷️',
        impact: 'positive',
        description: 'Offer controlled early-payment discounts to speed up inflow while preserving margin floor.',
        changes: [
          '2% discount for H2 payment within 15 days',
          '1% discount for on-time H3 settlement',
          'Cap discounts by concept profitability',
        ],
        implementation_ease: 'medium',
        requires_negotiation: 'low',
        confidence_score: 0.71,
      },
      {
        id: 'supplier-financing-program',
        name: 'Supplier Financing Program',
        icon: '🏦',
        impact: 'positive',
        description: 'Use supplier credit and financing programs to reduce internal working capital requirements.',
        changes: [
          'Negotiate net-60 for materials',
          'Apply reverse factoring for engineering invoices',
          'Tie escrow releases to acceptance checkpoints',
        ],
        implementation_ease: 'low',
        requires_negotiation: 'high',
        confidence_score: 0.65,
      },
    ];

    const factors = [0.72, 0.81, 0.67, 0.62, 0.56];
    const breakEvenDeltas = [-20, -12, -25, -30, -35];

    return templates
      .map((template, index) => {
        const projectedPeak = Number((baselinePeak * factors[index]).toFixed(2));
        const financingSaved = Number((baselinePeak - projectedPeak).toFixed(2));
        return {
          ...template,
          projected_peak_negative: projectedPeak,
          projected_break_even: Math.max(0, baselineBreakEven + breakEvenDeltas[index]),
          financing_saved: financingSaved,
        };
      })
      .sort((a, b) => b.financing_saved - a.financing_saved);
  }
}
