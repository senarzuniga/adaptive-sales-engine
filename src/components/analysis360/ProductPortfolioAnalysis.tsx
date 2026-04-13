import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { OrderRecord, StrategyRecord, ProductRecord, CompanyProfile } from '@/store/DataStore';
import { groupBy, fmt, COLORS } from './AnalysisUtils';
import { useMemo } from 'react';
import { Lightbulb, TrendingDown, Layers, Target, Shield, Eye } from 'lucide-react';

interface Props {
  orders: OrderRecord[];
  strategy: StrategyRecord[];
  products: ProductRecord[];
  company: CompanyProfile;
}

export const ProductPortfolioAnalysis = ({ orders, strategy, products, company }: Props) => {
  const totalRevenue = useMemo(() => orders.reduce((s, o) => s + o.sellingPrice, 0), [orders]);

  // Product families with detailed analysis
  const productData = useMemo(() => {
    const groups = groupBy(orders, o => o.productFamily);
    const years = [...new Set(orders.map(o => o.purchasingYear).filter(Boolean))].sort();
    const latestYear = years[years.length - 1];
    const prevYear = years.length > 1 ? years[years.length - 2] : null;

    return Object.entries(groups).map(([name, items]) => {
      const revenue = items.reduce((s, i) => s + i.sellingPrice, 0);
      const margin = items.reduce((s, i) => s + i.margin, 0);
      const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
      const customers = new Set(items.map(i => i.customerName)).size;
      const regions = new Set(items.map(i => i.region)).size;
      const share = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;

      // Growth trend
      const latestRev = items.filter(i => i.purchasingYear === latestYear).reduce((s, i) => s + i.sellingPrice, 0);
      const prevRev = prevYear ? items.filter(i => i.purchasingYear === prevYear).reduce((s, i) => s + i.sellingPrice, 0) : 0;
      const growth = prevRev > 0 ? ((latestRev - prevRev) / prevRev) * 100 : 0;

      // Classification: Innovation (growing, high margin), Commodity (stable, low margin), Decline (shrinking)
      let classification: 'innovation' | 'commodity' | 'decline' = 'commodity';
      if (growth > 15 && marginPct > 25) classification = 'innovation';
      else if (growth < -10) classification = 'decline';
      else if (marginPct < 15) classification = 'commodity';
      else if (growth > 5) classification = 'innovation';

      return { name, revenue, margin, marginPct, customers, regions, share, growth, classification, latestRev, orders: items.length };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [orders, totalRevenue]);

  // Classification summary
  const classificationSummary = useMemo(() => {
    const innovation = productData.filter(p => p.classification === 'innovation');
    const commodity = productData.filter(p => p.classification === 'commodity');
    const decline = productData.filter(p => p.classification === 'decline');
    return {
      innovation: { count: innovation.length, revenue: innovation.reduce((s, p) => s + p.revenue, 0) },
      commodity: { count: commodity.length, revenue: commodity.reduce((s, p) => s + p.revenue, 0) },
      decline: { count: decline.length, revenue: decline.reduce((s, p) => s + p.revenue, 0) },
    };
  }, [productData]);

  // Product vs Customer needs (which customers buy which products)
  const productCustomerMatrix = useMemo(() => {
    const topCustomers = [...new Set(orders.map(o => o.customerName))]
      .map(c => ({
        name: c,
        revenue: orders.filter(o => o.customerName === c).reduce((s, o) => s + o.sellingPrice, 0),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const topProducts = productData.slice(0, 8);

    return topCustomers.map(customer => {
      const row: any = { customer: customer.name };
      topProducts.forEach(p => {
        const rev = orders
          .filter(o => o.customerName === customer.name && o.productFamily === p.name)
          .reduce((s, o) => s + o.sellingPrice, 0);
        row[p.name] = rev;
      });
      return row;
    });
  }, [orders, productData]);

  // Strategy alignment
  const strategyAlignment = useMemo(() => {
    const stratByProduct = groupBy(strategy, s => s.productFamily);
    return productData.map(p => {
      const planned = (stratByProduct[p.name] || []).reduce((s, r) => s + r.estRevenue, 0);
      const achievement = planned > 0 ? (p.revenue / planned) * 100 : 0;
      return { ...p, planned, achievement };
    });
  }, [productData, strategy]);

  // Competitor context from company profile
  const competitors = company.main_competitors?.split(',').map(c => c.trim()).filter(Boolean) || [];

  const classIcon = (c: string) =>
    c === 'innovation' ? <Lightbulb className="h-3.5 w-3.5 text-success" /> :
    c === 'decline' ? <TrendingDown className="h-3.5 w-3.5 text-destructive" /> :
    <Layers className="h-3.5 w-3.5 text-warning" />;

  const classBadge = (c: string) =>
    c === 'innovation' ? 'default' as const : c === 'decline' ? 'destructive' as const : 'secondary' as const;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="sector" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="sector" className="gap-1"><Layers className="h-3 w-3" /> vs Sector</TabsTrigger>
          <TabsTrigger value="customers" className="gap-1"><Target className="h-3 w-3" /> vs Customer Needs</TabsTrigger>
          <TabsTrigger value="competitors" className="gap-1"><Shield className="h-3 w-3" /> vs Competitors</TabsTrigger>
          <TabsTrigger value="strategy" className="gap-1"><Eye className="h-3 w-3" /> vs Strategy</TabsTrigger>
        </TabsList>

        {/* ─── vs Sector (Commodity / Innovation / Decline) ─── */}
        <TabsContent value="sector">
          <div className="space-y-6">
            {/* Classification KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-l-4 border-l-success">
                <CardContent className="pt-5 flex items-center gap-3">
                  <Lightbulb className="h-6 w-6 text-success" />
                  <div>
                    <p className="text-xs text-muted-foreground">Innovation Products</p>
                    <p className="text-xl font-bold text-foreground">{classificationSummary.innovation.count}</p>
                    <p className="text-xs text-muted-foreground">{fmt(classificationSummary.innovation.revenue)} revenue</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-warning">
                <CardContent className="pt-5 flex items-center gap-3">
                  <Layers className="h-6 w-6 text-warning" />
                  <div>
                    <p className="text-xs text-muted-foreground">Commodity Products</p>
                    <p className="text-xl font-bold text-foreground">{classificationSummary.commodity.count}</p>
                    <p className="text-xs text-muted-foreground">{fmt(classificationSummary.commodity.revenue)} revenue</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-destructive">
                <CardContent className="pt-5 flex items-center gap-3">
                  <TrendingDown className="h-6 w-6 text-destructive" />
                  <div>
                    <p className="text-xs text-muted-foreground">Declining Products</p>
                    <p className="text-xl font-bold text-foreground">{classificationSummary.decline.count}</p>
                    <p className="text-xs text-muted-foreground">{fmt(classificationSummary.decline.revenue)} revenue</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Revenue by classification */}
            <Card>
              <CardHeader><CardTitle className="text-base">Revenue Share by Product Lifecycle Stage</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Innovation', value: classificationSummary.innovation.revenue },
                          { name: 'Commodity', value: classificationSummary.commodity.revenue },
                          { name: 'Decline', value: classificationSummary.decline.revenue },
                        ].filter(d => d.value > 0)}
                        cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        <Cell fill="hsl(150,60%,45%)" />
                        <Cell fill="hsl(35,90%,55%)" />
                        <Cell fill="hsl(0,70%,55%)" />
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      <strong>Innovation products</strong> represent growing, high-margin opportunities. 
                      <strong> Commodity products</strong> are mature, stable revenue sources with thinner margins. 
                      <strong> Declining products</strong> show negative growth trends and may need strategic review.
                    </p>
                    {classificationSummary.decline.revenue > totalRevenue * 0.2 && (
                      <div className="p-3 rounded bg-destructive/10 text-sm text-destructive">
                        ⚠️ Over 20% of revenue comes from declining products. Strategic action needed.
                      </div>
                    )}
                    {classificationSummary.innovation.revenue < totalRevenue * 0.15 && (
                      <div className="p-3 rounded bg-warning/10 text-sm text-warning">
                        ⚠️ Innovation products represent less than 15% of revenue. Portfolio renewal risk.
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Product detail table */}
            <Card>
              <CardHeader><CardTitle className="text-base">Product Classification Detail</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="text-xs">Product Family</TableHead>
                      <TableHead className="text-xs text-center">Classification</TableHead>
                      <TableHead className="text-xs text-right">Revenue</TableHead>
                      <TableHead className="text-xs text-right">Share</TableHead>
                      <TableHead className="text-xs text-right">Margin %</TableHead>
                      <TableHead className="text-xs text-right">Growth</TableHead>
                      <TableHead className="text-xs text-right">Customers</TableHead>
                      <TableHead className="text-xs text-right">Regions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {productData.map(p => (
                        <TableRow key={p.name}>
                          <TableCell className="text-xs font-medium flex items-center gap-1.5">
                            {classIcon(p.classification)} {p.name}
                          </TableCell>
                          <TableCell className="text-xs text-center">
                            <Badge variant={classBadge(p.classification)} className="text-[10px] capitalize">{p.classification}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{fmt(p.revenue)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{p.share.toFixed(1)}%</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{p.marginPct.toFixed(1)}%</TableCell>
                          <TableCell className={`text-xs text-right tabular-nums ${p.growth > 0 ? 'text-success' : p.growth < 0 ? 'text-destructive' : ''}`}>
                            {p.growth > 0 ? '+' : ''}{p.growth.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{p.customers}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{p.regions}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── vs Customer Needs ─── */}
        <TabsContent value="customers">
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Product Adoption by Top Customers</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Shows which products each top customer buys. Gaps indicate cross-sell opportunities.
                </p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="text-xs sticky left-0 bg-background">Customer</TableHead>
                      {productData.slice(0, 8).map(p => (
                        <TableHead key={p.name} className="text-xs text-center">{p.name}</TableHead>
                      ))}
                    </TableRow></TableHeader>
                    <TableBody>
                      {productCustomerMatrix.map(row => (
                        <TableRow key={row.customer}>
                          <TableCell className="text-xs font-medium sticky left-0 bg-background">{row.customer}</TableCell>
                          {productData.slice(0, 8).map(p => {
                            const val = row[p.name] || 0;
                            return (
                              <TableCell key={p.name} className="text-xs text-center">
                                {val > 0 ? (
                                  <span className="inline-block px-2 py-0.5 rounded bg-primary/10 text-primary font-medium text-[10px]">
                                    {fmt(val)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/30">—</span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Cross-sell opportunities */}
            <Card>
              <CardHeader><CardTitle className="text-base">Cross-Sell Opportunity Matrix</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Products NOT yet sold to high-value customers represent cross-sell potential.
                </p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="text-xs">Customer</TableHead>
                      <TableHead className="text-xs">Missing Products</TableHead>
                      <TableHead className="text-xs text-right">Current Revenue</TableHead>
                      <TableHead className="text-xs text-center">Potential</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {productCustomerMatrix.map(row => {
                        const missing = productData.slice(0, 8).filter(p => !row[p.name] || row[p.name] === 0);
                        const currentRev = productData.slice(0, 8).reduce((s, p) => s + (row[p.name] || 0), 0);
                        if (missing.length === 0) return null;
                        return (
                          <TableRow key={row.customer}>
                            <TableCell className="text-xs font-medium">{row.customer}</TableCell>
                            <TableCell className="text-xs">
                              <div className="flex flex-wrap gap-1">
                                {missing.map(m => (
                                  <Badge key={m.name} variant="outline" className="text-[10px]">{m.name}</Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-right tabular-nums">{fmt(currentRev)}</TableCell>
                            <TableCell className="text-xs text-center">
                              <Badge variant={missing.length >= 4 ? 'default' : 'secondary'} className="text-[10px]">
                                {missing.length} products
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── vs Competitors ─── */}
        <TabsContent value="competitors">
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Product Portfolio vs Competitive Landscape</CardTitle></CardHeader>
              <CardContent>
                {competitors.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Based on company profile data, your main competitors are: <strong>{competitors.join(', ')}</strong>
                    </p>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead className="text-xs">Product Family</TableHead>
                          <TableHead className="text-xs text-center">Classification</TableHead>
                          <TableHead className="text-xs text-right">Your Revenue</TableHead>
                          <TableHead className="text-xs text-right">Market Share (est)</TableHead>
                          <TableHead className="text-xs text-right">Margin %</TableHead>
                          <TableHead className="text-xs text-center">Competitive Position</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {productData.map(p => {
                            const position = p.marginPct > 25 && p.growth > 5 ? 'Leader' :
                              p.marginPct > 15 ? 'Challenger' : 'Follower';
                            return (
                              <TableRow key={p.name}>
                                <TableCell className="text-xs font-medium">{p.name}</TableCell>
                                <TableCell className="text-xs text-center">
                                  <Badge variant={classBadge(p.classification)} className="text-[10px] capitalize">{p.classification}</Badge>
                                </TableCell>
                                <TableCell className="text-xs text-right tabular-nums">{fmt(p.revenue)}</TableCell>
                                <TableCell className="text-xs text-right tabular-nums">
                                  {p.share > 30 ? 'Dominant' : p.share > 15 ? 'Significant' : 'Niche'}
                                </TableCell>
                                <TableCell className="text-xs text-right tabular-nums">{p.marginPct.toFixed(1)}%</TableCell>
                                <TableCell className="text-xs text-center">
                                  <Badge variant={position === 'Leader' ? 'default' : position === 'Challenger' ? 'secondary' : 'outline'} className="text-[10px]">
                                    {position}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No competitor data available. Add competitors in the Company Info page to enable competitive analysis.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Product positioning radar */}
            {productData.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Product Competitive Radar</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <RadarChart data={productData.slice(0, 6).map(p => ({
                      product: p.name,
                      revenue: Math.min(100, (p.share / Math.max(...productData.map(x => x.share))) * 100),
                      margin: Math.min(100, p.marginPct * 2),
                      growth: Math.min(100, Math.max(0, p.growth + 50)),
                      customers: Math.min(100, (p.customers / Math.max(...productData.map(x => x.customers))) * 100),
                      regions: Math.min(100, (p.regions / Math.max(...productData.map(x => x.regions))) * 100),
                    }))}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="product" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} />
                      <Radar name="Revenue" dataKey="revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                      <Radar name="Margin" dataKey="margin" stroke="hsl(150,60%,45%)" fill="hsl(150,60%,45%)" fillOpacity={0.1} />
                      <Tooltip />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ─── vs Strategy ─── */}
        <TabsContent value="strategy">
          <div className="space-y-6">
            {strategy.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Target className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Upload Strategy data to compare product performance against strategic targets.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader><CardTitle className="text-base">Product Strategy Alignment</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={strategyAlignment}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} angle={-20} textAnchor="end" height={60} />
                        <YAxis tickFormatter={fmt} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip formatter={(v: number) => fmt(v)} />
                        <Legend />
                        <Bar dataKey="planned" fill="hsl(var(--muted-foreground))" opacity={0.4} name="Strategy Target" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Actual Revenue" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">Strategy Achievement by Product</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead className="text-xs">Product</TableHead>
                          <TableHead className="text-xs text-center">Stage</TableHead>
                          <TableHead className="text-xs text-right">Target</TableHead>
                          <TableHead className="text-xs text-right">Actual</TableHead>
                          <TableHead className="text-xs text-right">Gap</TableHead>
                          <TableHead className="text-xs text-right">Achievement</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {strategyAlignment.map(p => (
                            <TableRow key={p.name}>
                              <TableCell className="text-xs font-medium">{p.name}</TableCell>
                              <TableCell className="text-xs text-center">
                                <Badge variant={classBadge(p.classification)} className="text-[10px] capitalize">{p.classification}</Badge>
                              </TableCell>
                              <TableCell className="text-xs text-right tabular-nums">{fmt(p.planned)}</TableCell>
                              <TableCell className="text-xs text-right tabular-nums">{fmt(p.revenue)}</TableCell>
                              <TableCell className={`text-xs text-right tabular-nums ${p.revenue - p.planned >= 0 ? 'text-success' : 'text-destructive'}`}>
                                {p.revenue - p.planned >= 0 ? '+' : ''}{fmt(p.revenue - p.planned)}
                              </TableCell>
                              <TableCell className="text-xs text-right tabular-nums">
                                {p.planned > 0 ? `${p.achievement.toFixed(0)}%` : '—'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={p.achievement >= 100 ? 'default' : p.achievement >= 70 ? 'secondary' : 'destructive'} className="text-[10px]">
                                  {p.achievement >= 100 ? 'On Track' : p.achievement >= 70 ? 'At Risk' : 'Behind'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
