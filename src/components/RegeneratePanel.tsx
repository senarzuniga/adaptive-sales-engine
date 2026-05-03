import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useData } from '@/store/DataStore';
import {
  fetchRegenerationStatus,
  regenerateAllData,
  resolvePendingContradiction,
  rollbackRegeneration,
  type PendingContradiction,
  type RegenerationLog,
} from '@/services/regenerationService';

function statusColor(status?: string | null) {
  if (!status) return 'secondary';
  if (status === 'completed') return 'default';
  if (status === 'failed') return 'destructive';
  if (status === 'waiting_manual_resolution') return 'destructive';
  return 'secondary';
}

export function RegeneratePanel() {
  const { activeCompanyId, setActiveCompany } = useData();
  const { toast } = useToast();
  const [working, setWorking] = useState(false);
  const [checking, setChecking] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [keepTemplates, setKeepTemplates] = useState(false);
  const [status, setStatus] = useState<RegenerationLog | null>(null);
  const [pending, setPending] = useState<PendingContradiction[]>([]);

  const unresolvedCount = pending.length;

  const stats = useMemo(() => {
    if (!status) return null;
    return {
      preEntities: status.pre_entity_count || 0,
      postEntities: status.post_entity_count || 0,
      preDocuments: status.pre_document_count || 0,
      postDocuments: status.post_document_count || 0,
    };
  }, [status]);

  const refreshStatus = async () => {
    if (!activeCompanyId) return;
    setChecking(true);
    try {
      const result = await fetchRegenerationStatus({ companyId: activeCompanyId });
      setStatus(result.log);
      setPending(result.pendingContradictions || []);
    } catch (error: any) {
      toast({
        title: 'Could not fetch regeneration status',
        description: error?.message || 'Unexpected status error',
        variant: 'destructive',
      });
    } finally {
      setChecking(false);
    }
  };

  const runRegeneration = async () => {
    if (!activeCompanyId) {
      toast({ title: 'Select a company first', variant: 'destructive' });
      return;
    }

    const accepted = window.confirm('WARNING: This will delete derived data and regenerate from source files. Continue?');
    if (!accepted) return;

    setWorking(true);
    try {
      const started = await regenerateAllData(keepTemplates, activeCompanyId);
      toast({
        title: 'Regeneration started',
        description: `Run ${started.regenerationId} is now in progress.`,
      });

      for (let i = 0; i < 120; i += 1) {
        const snapshot = await fetchRegenerationStatus({ companyId: activeCompanyId, regenerationId: started.regenerationId });
        setStatus(snapshot.log);
        setPending(snapshot.pendingContradictions || []);

        if (snapshot.log?.status === 'completed') {
          toast({ title: 'Regeneration complete', description: 'All panels will refresh with fresh data.' });
          setActiveCompany(activeCompanyId);
          return;
        }

        if (snapshot.log?.status === 'failed') {
          throw new Error('Regeneration ended in failed status. Check regeneration logs for details.');
        }

        if (snapshot.log?.status === 'waiting_manual_resolution') {
          toast({
            title: 'Manual contradiction resolution required',
            description: `${snapshot.pendingContradictions.length} contradictions require confirmation.`,
            variant: 'destructive',
          });
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      toast({
        title: 'Regeneration still running',
        description: 'Status polling timed out in the UI. You can refresh status manually.',
      });
    } catch (error: any) {
      toast({ title: 'Regeneration failed', description: error?.message || 'Unexpected error', variant: 'destructive' });
    } finally {
      setWorking(false);
    }
  };

  const resolveContradiction = async (contradiction: PendingContradiction, value: string) => {
    try {
      await resolvePendingContradiction(contradiction.id, value);
      toast({ title: 'Contradiction resolved', description: `${contradiction.field_name} for ${contradiction.entity_name}` });
      await refreshStatus();
    } catch (error: any) {
      toast({ title: 'Could not resolve contradiction', description: error?.message || 'Unexpected error', variant: 'destructive' });
    }
  };

  const rollbackLatest = async () => {
    if (!status?.id) {
      toast({ title: 'No regeneration selected', variant: 'destructive' });
      return;
    }

    const accepted = window.confirm('Rollback will restore the pre-regeneration snapshot. Continue?');
    if (!accepted) return;

    setRollingBack(true);
    try {
      await rollbackRegeneration(status.id);
      toast({ title: 'Rollback completed', description: 'The latest regeneration snapshot has been restored.' });
      if (activeCompanyId) setActiveCompany(activeCompanyId);
      await refreshStatus();
    } catch (error: any) {
      toast({ title: 'Rollback failed', description: error?.message || 'Unexpected error', variant: 'destructive' });
    } finally {
      setRollingBack(false);
    }
  };

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Full Data Regeneration
        </CardTitle>
        <CardDescription>
          Purge all derived ingestion and AI outputs, re-ingest source files, rerun cascaded agents, and validate integrity.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={keepTemplates}
              onChange={(event) => setKeepTemplates(event.target.checked)}
            />
            Keep templates and agent configuration
          </label>
          {status?.status && <Badge variant={statusColor(status.status) as any}>{status.status}</Badge>}
          {status?.id && <span className="text-xs text-muted-foreground">Run: {status.id}</span>}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="destructive" onClick={runRegeneration} disabled={working || !activeCompanyId}>
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Regenerate All Data (Apply New Protocols)
          </Button>
          <Button variant="outline" onClick={refreshStatus} disabled={checking || !activeCompanyId}>
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh Status
          </Button>
          <Button variant="outline" onClick={rollbackLatest} disabled={rollingBack || !status?.id}>
            {rollingBack ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Rollback Latest Regeneration
          </Button>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="rounded border p-2">
              <div className="text-muted-foreground">Entities (pre)</div>
              <div className="font-semibold">{stats.preEntities}</div>
            </div>
            <div className="rounded border p-2">
              <div className="text-muted-foreground">Entities (post)</div>
              <div className="font-semibold">{stats.postEntities}</div>
            </div>
            <div className="rounded border p-2">
              <div className="text-muted-foreground">Documents (pre)</div>
              <div className="font-semibold">{stats.preDocuments}</div>
            </div>
            <div className="rounded border p-2">
              <div className="text-muted-foreground">Documents (post)</div>
              <div className="font-semibold">{stats.postDocuments}</div>
            </div>
          </div>
        )}

        {unresolvedCount > 0 && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 space-y-3">
            <p className="text-sm font-medium text-amber-900">
              {unresolvedCount} contradictions require manual resolution before completion.
            </p>
            {pending.slice(0, 10).map((item) => (
              <div key={item.id} className="rounded border bg-white p-3 text-sm space-y-2">
                <p>
                  {item.entity_name} - {item.field_name}: "{item.value_a}" vs "{item.value_b}"
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => resolveContradiction(item, item.value_a)}>
                    Use value A
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => resolveContradiction(item, item.value_b)}>
                    Use value B
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const custom = window.prompt('Custom value', item.value_a) || '';
                      if (custom.trim()) resolveContradiction(item, custom.trim());
                    }}
                  >
                    Custom
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
