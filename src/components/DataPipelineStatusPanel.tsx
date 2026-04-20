import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

interface PipelineReport {
  validation_report?: ValidationSectionSummary[];
  enrichment_status?: EnrichmentAction[];
  conflicts?: ConflictRecord[];
}

const actionLabels: Record<string, string> = {
  field_filled: 'Fields Completed',
  entity_merged: 'Duplicates Merged',
  metric_derived: 'Metrics Derived',
  entity_linked: 'Entities Linked',
  conflict_resolved: 'Conflicts Resolved',
  ai_inferred: 'AI Inferred',
};

export function DataPipelineStatusPanel() {
  const { activeCompanyId } = useData();
  const [report, setReport] = useState<PipelineReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [tab, setTab] = useState<'validation' | 'enrichment' | 'conflicts'>('validation');

  const loadReport = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      const { data: validationData } = await supabase
        .from('entities_raw_extracted')
        .select('upload_section, validation_status, confidence_score, completeness_score')
        .eq('company_id', activeCompanyId);

      const sectionMap: Record<string, { total: number; validated: number; rejected: number; flagged: number; conf: number[]; comp: number[] }> = {};
      for (const row of validationData ?? []) {
        const s = row.upload_section ?? 'unknown';
        if (!sectionMap[s]) sectionMap[s] = { total: 0, validated: 0, rejected: 0, flagged: 0, conf: [], comp: [] };
        sectionMap[s].total++;
        if (row.validation_status === 'validated') sectionMap[s].validated++;
        else if (row.validation_status === 'rejected') sectionMap[s].rejected++;
        else sectionMap[s].flagged++;
        sectionMap[s].conf.push(row.confidence_score ?? 0);
        sectionMap[s].comp.push(row.completeness_score ?? 0);
      }

      const validation_report: ValidationSectionSummary[] = Object.entries(sectionMap).map(([section, d]) => ({
        section,
        total_records: d.total,
        validated: d.validated,
        rejected: d.rejected,
        flagged: d.flagged,
        acceptance_rate: d.total > 0 ? Number((d.validated / d.total).toFixed(4)) : 0,
        avg_confidence: d.conf.length > 0 ? Number((d.conf.reduce((a, b) => a + b, 0) / d.conf.length).toFixed(4)) : 0,
        avg_completeness: d.comp.length > 0 ? Number((d.comp.reduce((a, b) => a + b, 0) / d.comp.length).toFixed(4)) : 0,
      }));

      const { data: enrichmentData } = await supabase
        .from('enrichment_logs')
        .select('entity_table, action, is_ai_generated, created_at')
        .eq('company_id', activeCompanyId)
        .order('created_at', { ascending: false })
        .limit(500);

      const actionMap: Record<string, { count: number; last_at: string; ai_count: number }> = {};
      for (const row of enrichmentData ?? []) {
        const key = `${row.entity_table}::${row.action}`;
        if (!actionMap[key]) actionMap[key] = { count: 0, last_at: row.created_at, ai_count: 0 };
        actionMap[key].count++;
        if (row.is_ai_generated) actionMap[key].ai_count++;
        if (row.created_at > actionMap[key].last_at) actionMap[key].last_at = row.created_at;
      }

      const enrichment_status: EnrichmentAction[] = Object.entries(actionMap).map(([key, d]) => {
        const [entity_table, action] = key.split('::');
        return { entity_table, action, count: d.count, ai_generated: d.ai_count, last_enriched: d.last_at };
      });

      const { data: conflictData } = await supabase
        .from('entities_raw_extracted')
        .select('id, upload_section, anomalies, confidence_score, validation_status, extraction_timestamp')
        .eq('company_id', activeCompanyId)
        .in('validation_status', ['flagged', 'rejected'])
        .order('extraction_timestamp', { ascending: false })
        .limit(50);

      const conflicts: ConflictRecord[] = (conflictData ?? []).map((row: any) => ({
        record_id: row.id,
        section: row.upload_section,
        validation_status: row.validation_status,
        confidence_score: row.confidence_score ?? 0,
        anomalies: row.anomalies ?? [],
        extracted_at: row.extraction_timestamp,
      }));

      setReport({ validation_report, enrichment_status, conflicts });
    } catch (err: any) {
      console.error('Failed to load pipeline report:', err);
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    if (activeCompanyId) loadReport();
  }, [activeCompanyId, loadReport]);

  const runEnrichment = async () => {
    if (!activeCompanyId) return;
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-data', {
        body: { companyId: activeCompanyId },
      });
      if (error) throw error;
      toast({
        title: '✅ Enrichment complete',
        description: `${data?.total_actions ?? 0} actions applied across all entities.`,
      });
      await loadReport();
    } catch (err: any) {
      toast({ title: '❌ Enrichment failed', description: err?.message, variant: 'destructive' });
    } finally {
      setEnriching(false);
    }
  };

  if (!activeCompanyId) return null;

  const { validation_report = [], enrichment_status = [], conflicts = [] } = report ?? {};

  const totalValidated = validation_report.reduce((s, r) => s + r.validated, 0);
  const totalRejected = validation_report.reduce((s, r) => s + r.rejected, 0);
  const totalFlagged = validation_report.reduce((s, r) => s + r.flagged, 0);
  const totalEnrichments = enrichment_status.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
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
                <p className="text-xs text-muted-foreground">Flagged Records</p>
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

      {/* Controls */}
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

      {/* Tab content */}
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
