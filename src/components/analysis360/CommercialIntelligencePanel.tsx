import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle2, Layers3, Radar, Target, Workflow } from 'lucide-react';
import { CompanyProfile, OpportunityRecord, OrderRecord, ProductRecord, StrategyRecord } from '@/store/DataStore';
import { buildCommercialIntelligence } from '@/lib/commercialIntelligence';
import { fmt } from './AnalysisUtils';

interface Props {
  company: CompanyProfile;
  orders: OrderRecord[];
  opportunities: OpportunityRecord[];
  products: ProductRecord[];
  strategy: StrategyRecord[];
}

export const CommercialIntelligencePanel = ({ company, orders, opportunities, products, strategy }: Props) => {
  const intelligence = useMemo(() => buildCommercialIntelligence({ company, orders, opportunities, products, strategy }), [company, orders, opportunities, products, strategy]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Quality Gate</p>
            <div className="flex items-center gap-2">
              {intelligence.qualityGate.accepted ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
              <span className="font-semibold text-foreground">{intelligence.qualityGate.accepted ? 'Accepted' : 'Needs attention'}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Competitors tracked</p>
            <p className="text-2xl font-bold text-foreground">{intelligence.competitors.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Generated opportunities</p>
            <p className="text-2xl font-bold text-foreground">{intelligence.opportunities.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Prioritized actions</p>
            <p className="text-2xl font-bold text-foreground">{intelligence.actions.length}</p>
          </CardContent>
        </Card>
      </div>

      {!intelligence.qualityGate.accepted && (
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> System quality issues</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
              {intelligence.qualityGate.issues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Current vs target</p>
            <p className="text-2xl font-bold text-foreground">{intelligence.strategyDiagnostic.currentAchievementPct.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground mt-1">{fmt(intelligence.strategyDiagnostic.currentRevenue)} of {fmt(intelligence.strategyDiagnostic.targetRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Coverage incl. pipeline</p>
            <p className="text-2xl font-bold text-foreground">{intelligence.strategyDiagnostic.pipelineCoveragePct.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground mt-1">Gap still open: {fmt(intelligence.strategyDiagnostic.coverageGap)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Mix alignment</p>
            <p className="text-2xl font-bold text-foreground">{intelligence.strategyDiagnostic.mixAlignmentPct.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground mt-1">Target source: {intelligence.strategyDiagnostic.targetSource}</p>
          </CardContent>
        </Card>
      </div>

      {(intelligence.rootCauseMap.length > 0 || intelligence.bridgePlan.length > 0) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Root-cause map</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {intelligence.rootCauseMap.map((cause) => (
                <div key={cause.title} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-medium text-sm text-foreground">{cause.title}</p>
                    <Badge variant={cause.severity === 'high' ? 'destructive' : cause.severity === 'medium' ? 'secondary' : 'outline'} className="text-[10px]">{cause.severity}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{cause.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Bridge plan</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {intelligence.bridgePlan.map((item) => (
                <div key={item.title} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-medium text-sm text-foreground">{item.title}</p>
                    <Badge variant={item.priority === 'critical' ? 'destructive' : item.priority === 'high' ? 'default' : 'secondary'} className="text-[10px]">{item.priority}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.rationale}</p>
                  <p className="text-xs text-muted-foreground mt-1">Expected impact: {fmt(item.expectedImpact)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Workflow className="h-4 w-4" /> Cascade system status</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-3">
            {intelligence.cascade.stages.map((stage) => (
              <Badge key={stage} variant="outline" className="text-[10px]">{stage}</Badge>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Status: <span className="font-medium text-foreground">{intelligence.cascade.status}</span></p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Layers3 className="h-4 w-4" /> Key account mapping</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-xs">Customer</TableHead>
                <TableHead className="text-xs text-right">Revenue</TableHead>
                <TableHead className="text-xs text-right">Growth</TableHead>
                <TableHead className="text-xs text-right">Relationship</TableHead>
                <TableHead className="text-xs text-right">Tier</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {intelligence.keyAccounts.slice(0, 12).map((account) => (
                  <TableRow key={account.customer}>
                    <TableCell className="text-xs font-medium">{account.customer}</TableCell>
                    <TableCell className="text-xs text-right">{fmt(account.revenue)}</TableCell>
                    <TableCell className="text-xs text-right">{account.growthPotential}</TableCell>
                    <TableCell className="text-xs text-right">{account.relationshipStrength}</TableCell>
                    <TableCell className="text-xs text-right"><Badge variant={account.tier === 'A' ? 'default' : account.tier === 'B' ? 'secondary' : 'outline'}>{account.tier}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Radar className="h-4 w-4" /> Product portfolio analysis</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {intelligence.productPortfolio.map((product) => (
              <div key={product.name} className="border rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="font-medium text-sm text-foreground">{product.name}</p>
                  <Badge variant="outline" className="text-[10px]">{product.sectorClass}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Fit {product.fitScore} · Alignment {product.alignmentScore}</p>
                <p className="text-xs text-muted-foreground mt-1">{product.gapAnalysis}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" /> Competitor analysis</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {intelligence.competitors.map((competitor) => (
              <div key={competitor.name} className="border rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="font-medium text-sm text-foreground">{competitor.name}</p>
                  <Badge variant="outline" className="text-[10px]">{competitor.pricePositioning}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{competitor.positioning}</p>
                <p className="text-xs text-muted-foreground mt-1">Gap: {competitor.competitiveGap}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Market intelligence engine</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {intelligence.marketSegments.map((segment) => (
              <div key={segment.segment} className="border rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm text-foreground">{segment.segment}</p>
                  <Badge variant={segment.attractiveness === 'high' ? 'default' : 'secondary'} className="text-[10px]">{segment.attractiveness}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Revenue {fmt(segment.revenue)} · Leads {segment.leadCount}</p>
                {segment.similarCompanies.length > 0 && <p className="text-xs text-muted-foreground mt-1">Similar companies: {segment.similarCompanies.join(', ')}</p>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Strategic classification</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {intelligence.strategyClassification.map((item) => (
              <div key={item.name} className="border rounded-lg p-3">
                <div className="flex flex-wrap gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px]">{item.lifecycle}</Badge>
                  <Badge variant="outline" className="text-[10px]">{item.businessModel}</Badge>
                  <Badge variant="outline" className="text-[10px]">{item.competitiveStrategy}</Badge>
                </div>
                <p className="text-sm font-medium text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.recommendedAction}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Commercial opportunities</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {intelligence.opportunities.slice(0, 8).map((item) => (
              <div key={item.title} className="border rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="font-medium text-sm text-foreground">{item.title}</p>
                  <Badge variant={item.priority === 'critical' ? 'destructive' : item.priority === 'high' ? 'default' : 'secondary'} className="text-[10px]">{item.priority}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{item.description}</p>
                <p className="text-xs text-muted-foreground mt-1">Value {fmt(item.estimatedValue)} · Score {item.qualificationScore}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Action engine</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {intelligence.actions.slice(0, 8).map((action) => (
              <div key={action.title} className="border rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="font-medium text-sm text-foreground">{action.title}</p>
                  <Badge variant={action.priority === 'critical' ? 'destructive' : action.priority === 'high' ? 'default' : 'secondary'} className="text-[10px]">{action.priority}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Impact {fmt(action.expectedImpact)} · Effort {action.requiredEffort}</p>
                <p className="text-xs text-muted-foreground mt-1">{action.rationale}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Data usage enforcement</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-xs">Dataset</TableHead>
                <TableHead className="text-xs text-right">Loaded</TableHead>
                <TableHead className="text-xs">Used by</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {intelligence.dataUsage.map((entry) => (
                  <TableRow key={entry.dataset}>
                    <TableCell className="text-xs font-medium">{entry.dataset}</TableCell>
                    <TableCell className="text-xs text-right">{entry.loaded}</TableCell>
                    <TableCell className="text-xs">{entry.modules.length > 0 ? entry.modules.join(', ') : 'UNUSED → SYSTEM ERROR'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
