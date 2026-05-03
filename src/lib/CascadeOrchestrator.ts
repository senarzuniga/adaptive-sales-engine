import { supabase } from '@/integrations/supabase/client';
import {
  startRegeneration,
  fetchRegenerationStatus,
  rollbackRegeneration,
  resolvePendingContradiction,
  type RegenerationLog,
  type PendingContradiction,
  type RegenerationStartOptions,
} from '@/services/regenerationService';

export type OrchestratorStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'waiting_manual_resolution'
  | 'completed'
  | 'failed'
  | 'rolled_back'
  | 'dry_run';

export interface OrchestratorState {
  status: OrchestratorStatus;
  regenerationId: string | null;
  log: RegenerationLog | null;
  pendingContradictions: PendingContradiction[];
  error: string | null;
}

export type OrchestratorListener = (state: OrchestratorState) => void;

export class CascadeOrchestrator {
  private state: OrchestratorState = {
    status: 'idle',
    regenerationId: null,
    log: null,
    pendingContradictions: [],
    error: null,
  };

  private listeners: Set<OrchestratorListener> = new Set();
  private pollingTimer: ReturnType<typeof setTimeout> | null = null;
  private realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
  private companyId: string | null = null;

  subscribe(listener: OrchestratorListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private emit(patch: Partial<OrchestratorState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }

  getState(): OrchestratorState {
    return this.state;
  }

  async start(options: RegenerationStartOptions = {}): Promise<void> {
    if (this.state.status === 'running' || this.state.status === 'starting') {
      throw new Error('A regeneration is already in progress.');
    }

    this.companyId = options.companyId || null;
    this.emit({ status: 'starting', error: null, regenerationId: null, log: null, pendingContradictions: [] });

    try {
      const result = await startRegeneration(options);
      this.emit({ status: 'running', regenerationId: result.regenerationId });
      this.attachRealtimeChannel(result.regenerationId);
      this.scheduleStatusPoll(result.regenerationId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error starting regeneration';
      this.emit({ status: 'failed', error: message });
    }
  }

  async refreshStatus(regenerationId?: string | null): Promise<void> {
    const id = regenerationId || this.state.regenerationId;
    try {
      const payload = await fetchRegenerationStatus({
        regenerationId: id,
        companyId: this.companyId,
      });

      const log = payload.log;
      const pendingContradictions = payload.pendingContradictions || [];

      if (!log) {
        this.emit({ log: null, pendingContradictions });
        return;
      }

      const nextStatus = this.mapLogStatus(log.status);
      this.emit({
        status: nextStatus,
        log,
        pendingContradictions,
        regenerationId: log.id,
      });

      if (nextStatus === 'waiting_manual_resolution' || nextStatus === 'running') {
        this.scheduleStatusPoll(log.id);
      } else {
        this.stopPolling();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Status refresh failed';
      this.emit({ error: message });
    }
  }

  async resolveContradiction(id: string, resolvedValue: string, userId?: string | null): Promise<void> {
    await resolvePendingContradiction(id, resolvedValue, userId);
    await this.refreshStatus();
  }

  async rollback(regenerationId?: string): Promise<void> {
    const id = regenerationId || this.state.regenerationId;
    if (!id) throw new Error('No regeneration ID to roll back');

    this.emit({ error: null });
    try {
      await rollbackRegeneration(id);
      this.emit({ status: 'rolled_back' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Rollback failed';
      this.emit({ error: message });
    }
  }

  private mapLogStatus(status: string): OrchestratorStatus {
    const map: Record<string, OrchestratorStatus> = {
      running: 'running',
      waiting_manual_resolution: 'waiting_manual_resolution',
      completed: 'completed',
      failed: 'failed',
      rolled_back: 'rolled_back',
      dry_run: 'dry_run',
    };
    return map[status] || 'running';
  }

  private scheduleStatusPoll(regenerationId: string) {
    this.stopPolling();
    const delay = this.state.status === 'waiting_manual_resolution' ? 8000 : 4000;
    this.pollingTimer = setTimeout(() => {
      this.refreshStatus(regenerationId).catch(() => null);
    }, delay);
  }

  private stopPolling() {
    if (this.pollingTimer !== null) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private attachRealtimeChannel(regenerationId: string) {
    this.detachRealtimeChannel();
    this.realtimeChannel = supabase
      .channel(`regen_log_${regenerationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'regeneration_logs',
          filter: `id=eq.${regenerationId}`,
        },
        () => {
          this.refreshStatus(regenerationId).catch(() => null);
        },
      )
      .subscribe();
  }

  private detachRealtimeChannel() {
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel).catch(() => null);
      this.realtimeChannel = null;
    }
  }

  destroy() {
    this.stopPolling();
    this.detachRealtimeChannel();
    this.listeners.clear();
  }
}

export const cascadeOrchestrator = new CascadeOrchestrator();
