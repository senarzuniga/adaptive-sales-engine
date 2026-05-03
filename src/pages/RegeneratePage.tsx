import { useEffect, useState, useCallback, useRef } from 'react';
import { useData } from '@/store/DataStore';
import { cascadeOrchestrator, type OrchestratorState } from '@/lib/CascadeOrchestrator';
import { fetchRegenerationStatus } from '@/services/regenerationService';
import type { PendingContradiction } from '@/services/regenerationService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  RefreshCw,
  Play,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  ChevronRight,
} from 'lucide-react';

type Step = { step?: string; at?: string; status?: string; [key: string]: unknown };

const STATUS_COLORS: Record<string, string> = {
  idle: 'secondary',
  starting: 'secondary',
  running: 'default',
  waiting_manual_resolution: 'outline',
  completed: 'default',
  failed: 'destructive',
  rolled_back: 'secondary',
  dry_run: 'secondary',
};

const STATUS_LABELS: Record<string, string> = {
  idle: 'Idle',
  starting: 'Starting…',
  running: 'Running',
  waiting_manual_resolution: 'Awaiting Resolution',
  completed: 'Completed',
  failed: 'Failed',
  rolled_back: 'Rolled Back',
  dry_run: 'Dry Run',
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'running' || status === 'starting') return <Loader2 className="h-4 w-4 animate-spin" />;
  if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === 'failed') return <AlertTriangle className="h-4 w-4 text-destructive" />;
  if (status === 'waiting_manual_resolution') return <Clock className="h-4 w-4 text-yellow-500" />;
  return <ChevronRight className="h-4 w-4 text-muted-foreground" />;
}

function ContradictionRow({
  contradiction,
  onResolve,
}: {
  contradiction: PendingContradiction;
  onResolve: (id: string, value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(contradiction.value_a);
  const [resolving, setResolving] = useState(false);

  async function handleResolve() {
    setResolving(true);
    try {
      await onResolve(contradiction.id, value);
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="rounded-md border p-3 space-y-2 bg-card text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">
          {contradiction.entity_name || contradiction.entity_hash.slice(0, 12)}
        </span>
        <Badge variant="outline" className="text-xs">
          {contradiction.field_name}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div className="rounded border p-2 bg-muted/30">
          <p className="font-medium text-foreground mb-0.5">Value A</p>
          <p>{contradiction.value_a}</p>
          <p className="mt-0.5 text-muted-foreground/70">{contradiction.source_a}</p>
        </div>
        <div className="rounded border p-2 bg-muted/30">
          <p className="font-medium text-foreground mb-0.5">Value B</p>
          <p>{contradiction.value_b}</p>
          <p className="mt-0.5 text-muted-foreground/70">{contradiction.source_b}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Resolved value…"
          className="h-8 text-sm"
        />
        <Button
          size="sm"
          onClick={handleResolve}
          disabled={resolving || !value.trim()}
        >
          {resolving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Resolve'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setValue(contradiction.value_b)}
          className="text-xs"
        >
          Use B
        </Button>
      </div>
    </div>
  );
}

export default function RegeneratePage() {
  const { activeCompanyId } = useData();

  const [orchestratorState, setOrchestratorState] = useState<OrchestratorState>(
    cascadeOrchestrator.getState(),
  );
  const [keepTemplates, setKeepTemplates] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [scopeAll, setScopeAll] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const initialized = useRef(false);

  useEffect(() => {
    const unsub = cascadeOrchestrator.subscribe(setOrchestratorState);
    return unsub;
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    setLoadingHistory(true);
    fetchRegenerationStatus({ companyId: activeCompanyId })
      .then((payload) => {
        if (payload.log) {
          cascadeOrchestrator.refreshStatus(payload.log.id).catch(() => null);
        }
      })
      .catch(() => null)
      .finally(() => setLoadingHistory(false));
  }, [activeCompanyId]);

  const handleStart = useCallback(async () => {
    await cascadeOrchestrator.start({
      companyId: scopeAll ? null : activeCompanyId,
      keepTemplates,
      dryRun,
    });
  }, [activeCompanyId, keepTemplates, dryRun, scopeAll]);

  const handleRefresh = useCallback(() => {
    cascadeOrchestrator.refreshStatus().catch(() => null);
  }, []);

  const handleRollback = useCallback(async () => {
    if (!orchestratorState.regenerationId) return;
    if (!confirm('Roll back this regeneration? This will restore data from the backup snapshot.')) return;
    await cascadeOrchestrator.rollback();
  }, [orchestratorState.regenerationId]);

  const handleResolve = useCallback(async (id: string, value: string) => {
    await cascadeOrchestrator.resolveContradiction(id, value);
  }, []);

  const { status, log, pendingContradictions, error } = orchestratorState;
  const isActive = status === 'running' || status === 'starting';
  const canRollback = log && (status === 'completed' || status === 'waiting_manual_resolution' || status === 'failed');
  const executionLog: Step[] = (log?.execution_log as Step[]) || [];

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Data Regeneration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Full cascade rebuild — purge extracted data and reprocess all uploaded documents through the
            intelligence pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isActive || loadingHistory}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loadingHistory ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {canRollback && (
            <Button variant="outline" size="sm" onClick={handleRollback}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Rollback
            </Button>
          )}
        </div>
      </div>

      {/* Status card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <StatusIcon status={status} />
              {STATUS_LABELS[status] || status}
            </CardTitle>
            <Badge variant={STATUS_COLORS[status] as 'default' | 'secondary' | 'destructive' | 'outline' || 'secondary'}>
              {status}
            </Badge>
          </div>
        </CardHeader>
        {log && (
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="rounded-md bg-muted/40 p-2 text-center">
                <p className="text-muted-foreground text-xs">Pre / Post Docs</p>
                <p className="font-medium">{log.pre_document_count} → {log.post_document_count}</p>
              </div>
              <div className="rounded-md bg-muted/40 p-2 text-center">
                <p className="text-muted-foreground text-xs">Pre / Post Entities</p>
                <p className="font-medium">{log.pre_entity_count} → {log.post_entity_count}</p>
              </div>
              <div className="rounded-md bg-muted/40 p-2 text-center">
                <p className="text-muted-foreground text-xs">Docs Processed</p>
                <p className="font-medium">{log.documents_processed}</p>
              </div>
              <div className="rounded-md bg-muted/40 p-2 text-center">
                <p className="text-muted-foreground text-xs">Unresolved Contradictions</p>
                <p className={`font-medium ${log.unresolved_contradictions > 0 ? 'text-yellow-600' : ''}`}>
                  {log.unresolved_contradictions}
                </p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Started: {new Date(log.started_at).toLocaleString()}
              {log.completed_at && <> · Completed: {new Date(log.completed_at).toLocaleString()}</>}
              <span className="ml-2 font-mono select-all">{log.id.slice(0, 8)}…</span>
            </div>
          </CardContent>
        )}
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Pending contradictions */}
      {pendingContradictions.length > 0 && (
        <Card className="border-yellow-500/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-4 w-4" />
              {pendingContradictions.length} Pending Contradiction{pendingContradictions.length !== 1 ? 's' : ''}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Resolve all contradictions to let the pipeline complete and run downstream agents.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingContradictions.map((c) => (
              <ContradictionRow key={c.id} contradiction={c} onResolve={handleResolve} />
            ))}
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Launch controls */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Launch Regeneration</CardTitle>
          <p className="text-xs text-muted-foreground">
            This will purge all extracted data derived from uploaded documents and reprocess the full
            intelligence pipeline. Raw uploaded files are preserved.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <Switch id="sw-all" checked={scopeAll} onCheckedChange={setScopeAll} disabled={isActive} />
              <div>
                <Label htmlFor="sw-all" className="text-sm">All Companies</Label>
                <p className="text-xs text-muted-foreground">Ignore active company filter</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="sw-tpl" checked={keepTemplates} onCheckedChange={setKeepTemplates} disabled={isActive} />
              <div>
                <Label htmlFor="sw-tpl" className="text-sm">Keep Templates</Label>
                <p className="text-xs text-muted-foreground">Preserve content block templates</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="sw-dry" checked={dryRun} onCheckedChange={setDryRun} disabled={isActive} />
              <div>
                <Label htmlFor="sw-dry" className="text-sm">Dry Run</Label>
                <p className="text-xs text-muted-foreground">Simulate without writing data</p>
              </div>
            </div>
          </div>

          {!scopeAll && activeCompanyId && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded px-3 py-1.5">
              Scoped to company <span className="font-mono">{activeCompanyId.slice(0, 12)}…</span>
            </p>
          )}

          <Button
            onClick={handleStart}
            disabled={isActive}
            className="w-full sm:w-auto"
            variant={dryRun ? 'outline' : 'default'}
          >
            {isActive ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {dryRun ? 'Start Dry Run' : 'Start Regeneration'}
          </Button>
        </CardContent>
      </Card>

      {/* Execution log */}
      {executionLog.length > 0 && (
        <Accordion type="single" collapsible>
          <AccordionItem value="log">
            <AccordionTrigger className="text-sm font-medium">
              Execution Log ({executionLog.length} steps)
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {executionLog.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-xs rounded p-1.5 bg-muted/30 font-mono"
                  >
                    <span className="text-muted-foreground w-6 shrink-0">{idx + 1}</span>
                    <span className="text-foreground/70">{step.at ? new Date(step.at).toLocaleTimeString() : ''}</span>
                    <span className="font-semibold">{step.step}</span>
                    <Badge
                      variant={step.status === 'completed' ? 'default' : step.status === 'failed' ? 'destructive' : 'secondary'}
                      className="text-[10px] h-4 px-1"
                    >
                      {step.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
