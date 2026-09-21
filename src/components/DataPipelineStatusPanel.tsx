import { useCallback, useMemo, useState } from 'react';
import { useData } from '@/store/DataStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import {
  CheckCircle, AlertCircle, AlertTriangle, BarChart3,
  RefreshCw, Loader2, Database, GitBranch
} from 'lucide-react';

interface ValidationSectionSummary {
  section: string;
  total_records: number;
  validated: number;
  rejected: number;
  flagged: number;
  acceptance_rate: number;
  avg_confidence: number;
  avg_completeness: number;
}

interface EnrichmentAction {
  entity_table: string;
  action: string;
  count: number;
  ai_generated: number;
  last_enriched: string;
}

interface ConflictRecord {
  record_id: string;
  section: string;
  validation_status: string;
  confidence_score: number;
  anomalies: string[];
  extracted_at: string;
}

const actionLabels: Record<string, string> = {
  field_filled: 'Fields Completed',
  entity_merged: 'Duplicates Merged',
  metric_derived: 'Metrics Derived',
  entity_linked: 'Entities Linked',
  conflict_resolved: 'Conflicts Resolved',
  ai_inferred: 'AI Inferred',
};

const toSectionLabel = (value: string) => value.replace(/_/g, ' ');

export function DataPipelineStatusPanel() {
  const { activeCompanyId, data, triggerEnrichment } = useData();
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [tab, setTab] = useState<'validation' | 'enrichment' | 'conflicts'>('validation');

  const validation_report = useMemo<ValidationSectionSummary[]>(() => {
    const uploadMap = new Map<string, { total: number; validated: number; rejected: number; flagged: number; lastIssues: number }>();
    data.uploadLog.forEach((entry) => {
      const section = entry.detectedType || 'unknown';
      const current = uploadMap.get(section) || { total: 0, validated: 0, rejected: 0, flagged: 0, lastIssues: 0 };
      current.total += Math.max(1, Number(entry.rowCount || 0));
      current.lastIssues = entry.errors?.length || 0;
      if (entry.status === 'validated') {
        current.validated += Math.max(1, Number(entry.rowCount || 0));
      } else {
        current.rejected += Math.max(1, Number(entry.rowCount || 0));
      }
      uploadMap.set(section, current);
    });

    const qualityMap = new Map<string, (typeof data.qualityReports)[number]>(data.qualityReports.map((report) => [report.dataset, report]));
    const sections = new Set<string>([...uploadMap.keys(), ...qualityMap.keys()]);

    return Array.from(sections).map((section) => {
      const upload = uploadMap.get(section) || { total: 0, validated: 0, rejected: 0, flagged: 0, lastIssues: 0 };
      const quality = qualityMap.get(section);
      const total = Math.max(upload.total, quality?.rowCount || 0);
      const flagged = quality?.issues?.length ? Math.min(total, quality.issues.length) : upload.flagged;
      const validated = total > 0 ? Math.max(0, total - upload.rejected - flagged) : 0;
      const completeness = quality ? Math.max(0, 1 - Number(quality.nullPercentage || 0) / 100) : validated > 0 ? 1 : 0;
      return {
        section: toSectionLabel(section),
        total_records: total,
        validated,
        rejected: upload.rejected,
        flagged,
        acceptance_rate: total > 0 ? validated / total : 0,
        avg_confidence: completeness,
        avg_completeness: completeness,
      };
    }).sort((a, b) => b.total_records - a.total_records);
  }, [data.qualityReports, data.uploadLog]);

  const enrichment_status = useMemo<EnrichmentAction[]>(() => {
    const now = new Date().toISOString();
    const registryCounts = [
      { entity_table: 'companies', count: Object.keys(data.entityRegistries.companies || {}).length },
      { entity_table: 'customers', count: Object.keys(data.entityRegistries.customers || {}).length },
      { entity_table: 'products', count: Object.keys(data.entityRegistries.products || {}).length },
      { entity_table: 'contacts', count: Object.keys(data.entityRegistries.contacts || {}).length },
    ].filter((row) => row.count > 0);

    const rows: EnrichmentAction[] = registryCounts.map((row) => ({
      entity_table: row.entity_table,
      action: 'entity_linked',
      count: row.count,
      ai_generated: 0,
      last_enriched: now,
    }));

    if (data.enrichedProfiles.length > 0) {
      rows.unshift({
        entity_table: 'accounts',
        action: 'ai_inferred',
        count: data.enrichedProfiles.length,
        ai_generated: data.enrichedProfiles.length,
        last_enriched: now,
      });
    }

    return rows;
  }, [data.enrichedProfiles, data.entityRegistries]);

  const conflicts = useMemo<ConflictRecord[]>(() => {
    return data.qualityReports.flatMap((report) =>
      (report.issues || []).map((issue, index) => ({
        record_id: `${report.dataset}-${index}`,
        section: toSectionLabel(report.dataset),
        validation_status: 'flagged',
        confidence_score: Math.max(0, 1 - Number(report.nullPercentage || 0) / 100),
        anomalies: [issue],
        extracted_at: new Date().toISOString(),
      })),
    );
  }, [data.qualityReports]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    await Promise.resolve();
    setLoading(false);
    toast({ title: 'Pipeline report refreshed', description: 'The panel is now synchronized with the central data store.' });
  }, []);

  const runEnrichment = async () => {
    if (!activeCompanyId) return;
    setEnriching(true);
    try {
      await triggerEnrichment(activeCompanyId);
    } catch (err: any) {
      toast({ title: 'Enrichment failed', description: err?.message || 'Unable to run enrichment.', variant: 'destructive' });
    } finally {
      setEnriching(false);
    }
  };

  if (!activeCompanyId) return null;

  const totalValidated = validation_report.reduce((s, r) => s + r.validated, 0);
  const totalRejected = validation_report.reduce((s, r) => s + r.rejected, 0);
  const totalFlagged = validation_report.reduce((s, r) => s + r.flagged, 0);
  const totalEnrichments = enrichment_status.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-lg font-bold text-foreground">{totalValidated}</p>
                <p className="text-xs text-muted-foreground">Validated Records</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <div>
                <p className="text-lg font-bold text-foreground">{totalRejected}</p>
                <p className="text-xs text-muted-foreground">Rejected Records</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <div>
                <p className="text-lg font-bold text-foreground">{totalFlagged}</p>
                <p className="text-xs text-muted-foreground">Flagged Issues</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" />
              <div>
                <p className="text-lg font-bold text-foreground">{totalEnrichments}</p>
                <p className="text-xs text-muted-foreground">Enrichment Actions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['validation', 'enrichment', 'conflicts'] as const).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tab === t ? 'default' : 'outline'}
              className="text-xs capitalize"
              onClick={() => setTab(t)}
            >
              {t === 'validation' && <Database className="h-3 w-3 mr-1" />}
              {t === 'enrichment' && <GitBranch className="h-3 w-3 mr-1" />}
              {t === 'conflicts' && <AlertTriangle className="h-3 w-3 mr-1" />}
              {t}
              {t === 'conflicts' && conflicts.length > 0 && (
                <Badge variant="destructive" className="ml-1 text-[9px] px-1 py-0 h-4" aria-label={`${conflicts.length} conflicts`}>{conflicts.length}</Badge>
              )}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={loadReport} disabled={loading} className="gap-1 text-xs">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" onClick={runEnrichment} disabled={enriching} className="gap-1 text-xs">
            {enriching ? <Loader2 className="h-3 w-3 animate-spin" /> : <BarChart3 className="h-3 w-3" />}
            Run Enrichment
          </Button>
        </div>
      </div>

      {tab === 'validation' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Validation Report by Section</CardTitle>
          </CardHeader>
          <CardContent>
            {validation_report.length === 0 ? (
              <p className="text-xs text-muted-foreground">No extracted records yet. Upload documents to start the pipeline.</p>
            ) : (
              <div className="space-y-2">
                {validation_report.map((row) => (
                  <div key={row.section} className="flex items-center gap-3 text-xs border rounded-md p-2">
                    <span className="font-medium capitalize w-28 flex-shrink-0">{row.section}</span>
                    <div className="flex gap-3 flex-1 flex-wrap">
                      <span className="text-green-600">{row.validated} ✓ validated</span>
                      {row.rejected > 0 && <span className="text-destructive">{row.rejected} ✗ rejected</span>}
                      {row.flagged > 0 && <span className="text-amber-500">{row.flagged} ⚑ flagged</span>}
                    </div>
                    <div className="flex gap-2 text-muted-foreground flex-shrink-0">
                      <span>conf: {(row.avg_confidence * 100).toFixed(0)}%</span>
                      <span>acc: {(row.acceptance_rate * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'enrichment' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Enrichment Actions Log</CardTitle>
          </CardHeader>
          <CardContent>
            {enrichment_status.length === 0 ? (
              <p className="text-xs text-muted-foreground">No enrichment actions yet. Click "Run Enrichment" to start.</p>
            ) : (
              <div className="space-y-1.5">
                {enrichment_status.map((row, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs border rounded-md p-2">
                    <span className="font-medium capitalize w-28 flex-shrink-0">{row.entity_table}</span>
                    <span className="flex-1 text-muted-foreground">{actionLabels[row.action] ?? row.action}</span>
                    <span className="font-medium">{row.count}×</span>
                    {row.ai_generated > 0 && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">AI: {row.ai_generated}</Badge>
                    )}
                    <span className="text-muted-foreground flex-shrink-0">
                      {new Date(row.last_enriched).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'conflicts' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Flagged &amp; Rejected Records</CardTitle>
          </CardHeader>
          <CardContent>
            {conflicts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No conflicts or rejected records.</p>
            ) : (
              <div className="space-y-1.5">
                {conflicts.map((row) => (
                  <div key={row.record_id} className="text-xs border rounded-md p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={row.validation_status === 'rejected' ? 'destructive' : 'outline'}
                        className="text-[9px] px-1 py-0 h-4"
                      >
                        {row.validation_status}
                      </Badge>
                      <span className="font-medium capitalize">{row.section}</span>
                      <span className="text-muted-foreground ml-auto">
                        conf: {(row.confidence_score * 100).toFixed(0)}%
                      </span>
                    </div>
                    {row.anomalies.length > 0 && (
                      <p className="text-muted-foreground truncate" title={row.anomalies.join(' | ')}>
                        {row.anomalies.slice(0, 2).join(' · ')}
                        {row.anomalies.length > 2 && ` +${row.anomalies.length - 2} more`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
