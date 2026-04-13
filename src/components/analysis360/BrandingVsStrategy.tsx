import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { OrderRecord, StrategyRecord, CompanyProfile } from '@/store/DataStore';
import { groupBy, fmt, COLORS } from './AnalysisUtils';
import { useMemo } from 'react';
import { Eye, Target, Zap, AlertTriangle } from 'lucide-react';

interface Props {
  orders: OrderRecord[];
  strategy: StrategyRecord[];
  company: CompanyProfile;
}

export const BrandingVsStrategy = ({ orders, strategy, company }: Props) => {
  const totalRevenue = useMemo(() => orders.reduce((s, o) => s + o.sellingPrice, 0), [orders]);

  // Segment analysis — how well does the brand reach its target segments?
  const segmentData = useMemo(() => {
    const stratSegments = groupBy(strategy, s => s.numberOfSegment);
    const actualSegments = groupBy(orders, o => o.segment);
    const allSegments = [...new Set([...Object.keys(stratSegments), ...Object.keys(actualSegments)])].filter(Boolean);
    return allSegments.map(seg => {
      const planned = (stratSegments[seg] || []).reduce((s, r) => s + r.estRevenue, 0);
      const actual = (actualSegments[seg] || []).reduce((s, r) => s + r.sellingPrice, 0);
      return { name: seg, planned, actual, gap: actual - planned, pct: planned > 0 ? (actual / planned) * 100 : 0 };
    }).sort((a, b) => b.actual - a.actual);
  }, [orders, strategy]);

  // Brand reach indicators
  const brandIndicators = useMemo(() => {
    const customers = new Set(orders.map(o => o.customerName)).size;
    const regions = new Set(orders.map(o => o.region)).size;
    const countries = new Set(orders.map(o => o.country)).size;
    const segments = new Set(orders.map(o => o.segment).filter(Boolean)).size;
    const products = new Set(orders.map(o => o.productFamily).filter(Boolean)).size;
    
    // Revenue per customer as brand loyalty proxy
    const avgRevenuePerCustomer = customers > 0 ? totalRevenue / customers : 0;
    
    // Repeat purchase rate
    const customerOrders = groupBy(orders, o => o.customerName);
    const repeatCustomers = Object.values(customerOrders).filter(items => items.length > 1).length;
    const repeatRate = customers > 0 ? (repeatCustomers / customers) * 100 : 0;

    return { customers, regions, countries, segments, products, avgRevenuePerCustomer, repeatRate, repeatCustomers };
  }, [orders, totalRevenue]);

  // Strategic alignment assessment
  const strategicFit = useMemo(() => {
    const assessments: { area: string; status: 'aligned' | 'misaligned' | 'partial'; detail: string }[] = [];
    
    // Check if actual customer segments match strategy
    if (company.main_customer_segments) {
      const targetSegments = company.main_customer_segments.split(',').map(s => s.trim()).filter(Boolean);
      const actualSegments = [...new Set(orders.map(o => o.segment).filter(Boolean))];
      const overlap = targetSegments.filter(t => actualSegments.some(a => a.toLowerCase().includes(t.toLowerCase())));
      assessments.push({
        area: 'Target Segments',
        status: overlap.length >= targetSegments.length * 0.7 ? 'aligned' : overlap.length > 0 ? 'partial' : 'misaligned',
        detail: `${overlap.length}/${targetSegments.length} target segments active in sales`,
      });
    }

    // Geographic coverage vs strategy
    if (company.operating_regions) {
      const targetRegions = company.operating_regions.split(',').map(s => s.trim()).filter(Boolean);
      const actualRegions = [...new Set(orders.map(o => o.region).filter(Boolean))];
      assessments.push({
        area: 'Geographic Coverage',
        status: actualRegions.length >= targetRegions.length ? 'aligned' : actualRegions.length >= targetRegions.length * 0.5 ? 'partial' : 'misaligned',
        detail: `${actualRegions.length} active regions vs ${targetRegions.length} target`,
      });
    }

    // Product portfolio alignment
    if (company.main_products) {
      const targetProducts = company.main_products.split(',').map(s => s.trim()).filter(Boolean);
      const actualProducts = [...new Set(orders.map(o => o.productFamily).filter(Boolean))];
      assessments.push({
        area: 'Product Portfolio',
        status: actualProducts.length >= targetProducts.length * 0.7 ? 'aligned' : 'partial',
        detail: `${actualProducts.length} product families active vs ${targetProducts.length} defined`,
      });
    }

    // Brand loyalty (repeat rate)
    assessments.push({
      area: 'Customer Loyalty',
      status: brandIndicators.repeatRate > 50 ? 'aligned' : brandIndicators.repeatRate > 25 ? 'partial' : 'misaligned',
      detail: `${brandIndicators.repeatRate.toFixed(0)}% repeat purchase rate`,
    });

    // Revenue concentration as brand risk
    const topCustomerShare = orders.length > 0 ? (() => {
      const byC = groupBy(orders, o => o.customerName);
      const top = Math.max(...Object.values(byC).map(items => items.reduce((s, i) => s + i.sellingPrice, 0)));
      return (top / totalRevenue) * 100;
    })() : 0;

    assessments.push({
      area: 'Brand Diversification',
      status: topCustomerShare < 20 ? 'aligned' : topCustomerShare < 35 ? 'partial' : 'misaligned',
      detail: `Top customer = ${topCustomerShare.toFixed(0)}% of revenue`,
    });

    return assessments;
  }, [orders, company, totalRevenue, brandIndicators]);

  const statusIcon = (s: string) =>
    s === 'aligned' ? '✅' : s === 'partial' ? '⚠️' : '❌';

  return (
    <div className="space-y-6">
      {/* Brand KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5 pb-4">
          <p className="text-xs text-muted-foreground mb-1">Customer Base</p>
          <p className="text-2xl font-bold text-foreground">{brandIndicators.customers}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <p className="text-xs text-muted-foreground mb-1">Repeat Rate</p>
          <p className="text-2xl font-bold text-foreground">{brandIndicators.repeatRate.toFixed(0)}%</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <p className="text-xs text-muted-foreground mb-1">Avg Revenue/Customer</p>
          <p className="text-2xl font-bold text-foreground">{fmt(brandIndicators.avgRevenuePerCustomer)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <p className="text-xs text-muted-foreground mb-1">Market Reach</p>
          <p className="text-2xl font-bold text-foreground">{brandIndicators.regions} regions / {brandIndicators.countries} countries</p>
        </CardContent></Card>
      </div>

      {/* Strategic Alignment Score */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Brand & Image vs Strategic Alignment</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-xs">Strategic Area</TableHead>
                <TableHead className="text-xs text-center">Alignment</TableHead>
                <TableHead className="text-xs">Assessment</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {strategicFit.map(s => (
                  <TableRow key={s.area}>
                    <TableCell className="text-xs font-medium">{s.area}</TableCell>
                    <TableCell className="text-xs text-center">
                      <span className="text-base">{statusIcon(s.status)}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {strategicFit.filter(s => s.status === 'misaligned').length > 0 && (
            <div className="mt-4 p-3 rounded bg-destructive/10 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">
                {strategicFit.filter(s => s.status === 'misaligned').length} areas show strategic misalignment. 
                Brand positioning may not match the company's stated objectives.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Segment Performance vs Strategy */}
      {segmentData.length > 0 && strategy.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Segment Performance vs Strategy</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={segmentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis tickFormatter={fmt} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="planned" fill="hsl(var(--muted-foreground))" opacity={0.4} name="Strategy Target" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" fill="hsl(var(--primary))" name="Actual" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Company strategic context */}
      {(company.strategic_goals || company.objectives || company.business_description) && (
        <Card>
          <CardHeader><CardTitle className="text-base">Strategic Context Reference</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {company.business_description && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Business Description</p>
                <p className="text-sm text-foreground">{company.business_description}</p>
              </div>
            )}
            {company.strategic_goals && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Strategic Goals</p>
                <p className="text-sm text-foreground">{company.strategic_goals}</p>
              </div>
            )}
            {company.objectives && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Objectives</p>
                <p className="text-sm text-foreground">{company.objectives}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
