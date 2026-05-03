import {
  fetchRegenerationStatus,
  regenerateAllData,
  resolvePendingContradiction,
  type PendingContradiction,
  type RegenerationStatusResponse,
} from '@/services/regenerationService';

export interface RegenerationOrchestratorOptions {
  companyId?: string | null;
  keepTemplates?: boolean;
  contradictionTimeoutMs?: number;
  onProgress?: (message: string, status?: RegenerationStatusResponse | null) => void;
}

export class RegenerationOrchestrator {
  private readonly companyId?: string | null;

  private readonly keepTemplates: boolean;

  private readonly contradictionTimeoutMs: number;

  private readonly onProgress?: (message: string, status?: RegenerationStatusResponse | null) => void;

  constructor(options: RegenerationOrchestratorOptions = {}) {
    this.companyId = options.companyId;
    this.keepTemplates = options.keepTemplates ?? false;
    this.contradictionTimeoutMs = options.contradictionTimeoutMs ?? 60 * 60 * 1000;
    this.onProgress = options.onProgress;
  }

  private emit(message: string, status?: RegenerationStatusResponse | null) {
    this.onProgress?.(message, status);
  }

  async batchProcess<T>(items: T[], batchSize: number, worker: (item: T) => Promise<unknown>) {
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await Promise.all(batch.map((item) => worker(item)));
    }
  }

  async runSequential(steps: Array<() => Promise<unknown>>) {
    for (const step of steps) {
      await step();
    }
  }

  async getAllOriginalFiles() {
    const status = await fetchRegenerationStatus({ companyId: this.companyId || null });
    const count = status.log?.pre_document_count || 0;
    return Array.from({ length: count }, (_, index) => ({ index }));
  }

  async runIngestionPipeline(_file: { index: number }) {
    return Promise.resolve();
  }

  async waitForContradictionsResolution() {
    const start = Date.now();
    let latest: RegenerationStatusResponse | null = null;

    while (Date.now() - start < this.contradictionTimeoutMs) {
      latest = await fetchRegenerationStatus({ companyId: this.companyId || null });
      const pending = latest.pendingContradictions || [];
      if (pending.length === 0) {
        return latest;
      }
      this.emit(`Waiting for contradiction resolution (${pending.length} pending).`, latest);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    throw new Error('Contradiction resolution timeout after 1 hour.');
  }

  async regeneratePortfolioAnalysis() {
    this.emit('Portfolio analysis regeneration delegated to backend cascade.');
  }

  async regenerate360Analysis() {
    this.emit('360 analysis regeneration delegated to backend cascade.');
  }

  async regenerateProposals() {
    this.emit('Proposal regeneration delegated to backend cascade.');
  }

  async regenerateActions() {
    this.emit('Action regeneration delegated to backend cascade.');
  }

  async regenerateMonitoring() {
    this.emit('Monitoring regeneration delegated to backend cascade.');
  }

  async regenerateContent() {
    this.emit('Content regeneration delegated to backend cascade.');
  }

  async regenerateForecasts() {
    this.emit('Forecast regeneration delegated to backend cascade.');
  }

  async runEliteLoopLearning() {
    this.emit('Elite loop learning signals delegated to backend cascade.');
  }

  async runIntegrityCheck() {
    const status = await fetchRegenerationStatus({ companyId: this.companyId || null });
    const log = status.log;
    if (!log) throw new Error('No regeneration log found for integrity checks.');
    if (log.status !== 'completed') throw new Error(`Regeneration did not complete successfully (status: ${log.status}).`);

    const entityDelta = Math.abs((log.post_entity_count || 0) - (log.pre_entity_count || 0));
    const documentDelta = Math.abs((log.post_document_count || 0) - (log.pre_document_count || 0));
    if (entityDelta > 0 || documentDelta > 0) {
      this.emit('Integrity check warning: pre/post counts differ.', status);
    }

    return status;
  }

  async fullRegenerate() {
    this.emit('Step 1: Purging and restarting pipeline.');
    const startResult = await regenerateAllData(this.keepTemplates, this.companyId || null);

    this.emit('Step 2: Re-ingestion started.');
    const files = await this.getAllOriginalFiles();
    await this.batchProcess(files, 5, async (file) => this.runIngestionPipeline(file));

    this.emit('Step 3: Waiting contradiction resolution.');
    await this.waitForContradictionsResolution();

    this.emit('Step 4: Running cascades in topological order.');
    await this.runSequential([
      () => this.regeneratePortfolioAnalysis(),
      () => this.regenerate360Analysis(),
      () => Promise.all([
        this.regenerateProposals(),
        this.regenerateActions(),
        this.regenerateMonitoring(),
      ]),
      () => this.regenerateContent(),
      () => this.regenerateForecasts(),
      () => this.runEliteLoopLearning(),
    ]);

    this.emit('Step 5: Running integrity checks.');
    const status = await this.runIntegrityCheck();

    return {
      regenerationId: startResult.regenerationId,
      status,
    };
  }

  async resolveContradiction(contradiction: PendingContradiction, preferred: 'a' | 'b' | string, userId?: string) {
    const value = preferred === 'a'
      ? contradiction.value_a
      : preferred === 'b'
        ? contradiction.value_b
        : preferred;

    return resolvePendingContradiction(contradiction.id, value, userId || null);
  }
}
