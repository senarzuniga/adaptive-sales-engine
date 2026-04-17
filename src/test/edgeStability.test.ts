import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildFallbackActionContent,
  buildFallbackExecutiveInsights,
  classifyEdgeRuntimeError,
  invokeEdgeWithRetry,
} from '@/lib/edgeStability';

describe('edge stability fallbacks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('converts non-2xx edge errors into a friendly fallback message', () => {
    const details = classifyEdgeRuntimeError({ message: 'Edge Function returned a non-2xx status code', context: { status: 503 } }, 'local recovery');

    expect(details.retryable).toBe(true);
    expect(details.description.toLowerCase()).toContain('local recovery');
  });

  it('retries a temporary AI outage before succeeding', async () => {
    const invokeSpy = vi.fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Edge Function returned a non-2xx status code', context: { status: 503 } },
      })
      .mockResolvedValueOnce({
        data: { ok: true },
        error: null,
      });

    const result = await invokeEdgeWithRetry<{ ok: boolean }>('analyze-360', { sample: true }, { retries: 1, baseDelayMs: 0, invoke: invokeSpy });

    expect(result.ok).toBe(true);
    expect(invokeSpy).toHaveBeenCalledTimes(2);
  });

  it('builds local action content when the AI edge function is unavailable', () => {
    const content = buildFallbackActionContent({
      task: { title: 'Recover stalled offer', description: 'Move the deal forward', category: 'follow_up' },
      companyProfile: { company_name: 'Adaptive Sales Engine' },
    });

    expect(content.goal).toContain('Recover stalled offer');
    expect(content.callScript.length).toBeGreaterThan(20);
    expect(content.emailTemplate.length).toBeGreaterThan(20);
  });

  it('creates local executive insights without remote AI', () => {
    const insights = buildFallbackExecutiveInsights({
      company: { company_name: 'Adaptive Sales Engine' },
      orders: [{ sellingPrice: 300000, margin: 25, customerName: 'Acme', region: 'Spain', purchasingYear: '2026', productFamily: 'Services', kam: 'Ana' }],
      opportunities: [{ estRevenue: 200000, contractProb: 80, status: 'open', customerName: 'Beta', productFamily: 'Upgrades', region: 'France' }],
      products: [{ name: 'Services', type: 'Innovation', averageValue: 50000 }],
      strategy: [{ estRevenue: 600000 }],
    });

    expect(insights.executive_summary.toLowerCase()).toContain('local');
    expect(insights.critical_insights.length).toBeGreaterThan(0);
    expect(insights.recommendations.length).toBeGreaterThan(0);
  });
});
