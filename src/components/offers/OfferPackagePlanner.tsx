import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import type { OfferCostPolicy } from '@/lib/utils';
import type { OfferPackageDraft, OfferPackageType } from '@/lib/offerPackages';
import { buildPackageContentsText, buildPackageExecutiveDetail, createOfferPackage, isInstallationPackage, summarizePackageCostWithPolicy } from '@/lib/offerPackages';

interface OfferPackagePlannerProps {
  isEs: boolean;
  currency: string;
  pricingPolicy: OfferCostPolicy;
  items: Array<{ id: string; name: string; description: string; quantity: number }>;
  costRows: Array<{ offer_item_id?: string; category?: string; line_item?: string; total_cost?: number }>;
  packages: OfferPackageDraft[];
  onChange: (packages: OfferPackageDraft[]) => void;
}

const PACKAGE_TYPES: Array<{ value: OfferPackageType; en: string; es: string }> = [
  { value: 'core', en: 'Core package', es: 'Paquete principal' },
  { value: 'optional', en: 'Optional package', es: 'Paquete opcional' },
  { value: 'installation', en: 'Installation package', es: 'Paquete de instalacion' },
];

const money = (value: number, currency: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value || 0));

export function OfferPackagePlanner({ isEs, currency, pricingPolicy, items, costRows, packages, onChange }: OfferPackagePlannerProps) {
  const updatePackage = (packageId: string, patch: Partial<OfferPackageDraft>) => onChange(packages.map((pkg) => pkg.id === packageId ? { ...pkg, ...patch } : pkg));
  const nextOrder = Math.max(0, ...packages.map((pkg) => Number(pkg.sortOrder || 0))) + 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">{isEs ? 'Paquetes comerciales' : 'Commercial packages'}</CardTitle>
            <CardDescription>
              {isEs ? 'Agrupa elementos configurados, define precio de venta por paquete y analiza costes directos, politicas y margen sobre precio propuesto.' : 'Group configured items, define package selling price and analyze direct cost, policy-loaded cost and margin on the proposed price.'}
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => onChange([...packages, createOfferPackage(nextOrder)])}>
            <Plus className="h-4 w-4 mr-2" />
            {isEs ? 'Anadir paquete' : 'Add package'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {packages.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {isEs ? 'Todavia no hay paquetes. Crea uno y asigna elementos de la oferta.' : 'No packages yet. Create one and assign offer items.'}
          </div>
        ) : null}
        {packages
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((pkg) => {
            const pricing = summarizePackageCostWithPolicy(pkg, items, costRows, pricingPolicy);
            const packageCost = pricing.totalCostWithPolicy;
            const directCost = pricing.directCost;
            const policyCost = pricing.policyCharges.total;
            const price = Number(pkg.commercialPrice || 0);
            const margin = price - packageCost;
            const marginPct = price > 0 ? margin / price * 100 : 0;
            const breakEvenPrice = packageCost;
            const contents = buildPackageContentsText(pkg, items);
            const executiveDetail = buildPackageExecutiveDetail(pkg, items, costRows);
            const installationPackage = isInstallationPackage(pkg, costRows);

            return (
              <div key={pkg.id} className="rounded-lg border bg-muted/20 p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-sm font-medium text-foreground">{isEs ? 'Nombre del paquete' : 'Package name'}</label>
                    <Input value={pkg.name} onChange={(event) => updatePackage(pkg.id, { name: event.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">{isEs ? 'Tipo' : 'Type'}</label>
                    <Select value={pkg.type} onValueChange={(value) => updatePackage(pkg.id, { type: value as OfferPackageType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PACKAGE_TYPES.map((entry) => <SelectItem key={entry.value} value={entry.value}>{isEs ? entry.es : entry.en}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">{isEs ? 'Orden' : 'Order'}</label>
                    <Input type="number" min={1} value={pkg.sortOrder} onChange={(event) => updatePackage(pkg.id, { sortOrder: Number(event.target.value || 0) })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">{isEs ? 'Precio propuesto' : 'Proposed price'}</label>
                    <Input type="number" min={0} value={pkg.commercialPrice} onChange={(event) => updatePackage(pkg.id, { commercialPrice: Number(event.target.value || 0) })} />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">{isEs ? 'Detalle ejecutivo' : 'Executive detail'}</label>
                  <Textarea rows={3} value={pkg.executiveSummary} onChange={(event) => updatePackage(pkg.id, { executiveSummary: event.target.value })} placeholder={isEs ? 'Resumen ejecutivo del alcance del paquete.' : 'Executive summary of the package scope.'} />
                  <p className="mt-1 text-xs text-muted-foreground">{executiveDetail}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{isEs ? 'Elementos incluidos' : 'Included items'}</span>
                    {installationPackage ? <Badge variant="secondary">{isEs ? 'Cargara notas de instalacion en Word' : 'Installation notes forced into Word'}</Badge> : null}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {items.map((item) => (
                      <label key={item.id} className="flex items-start gap-2 rounded-md border bg-background p-2 text-sm">
                        <input
                          type="checkbox"
                          checked={pkg.itemIds.includes(item.id)}
                          onChange={(event) => updatePackage(pkg.id, { itemIds: event.target.checked ? [...pkg.itemIds, item.id] : pkg.itemIds.filter((entry) => entry !== item.id) })}
                        />
                        <span>
                          <span className="font-medium">{item.name || (isEs ? 'Elemento sin nombre' : 'Unnamed item')}</span>
                          {item.description ? <span className="block text-xs text-muted-foreground mt-1">{item.description}</span> : null}
                        </span>
                      </label>
                    ))}
                  </div>
                  {contents ? <p className="text-xs text-muted-foreground">{contents}</p> : null}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-xs text-muted-foreground">{isEs ? 'Coste directo' : 'Direct cost'}</p>
                    <p className="text-lg font-semibold">{money(directCost, currency)}</p>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-xs text-muted-foreground">{isEs ? 'Politicas aplicadas' : 'Policy charges'}</p>
                    <p className="text-lg font-semibold">{money(policyCost, currency)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {isEs ? `Garantia ${pricingPolicy.warrantyPct}% + estructura ${pricingPolicy.materialStructurePct}% + finanzas ${pricingPolicy.financialPct}% + gestion ${pricingPolicy.commercialMgmtPct}%` : `Warranty ${pricingPolicy.warrantyPct}% + structure ${pricingPolicy.materialStructurePct}% + finance ${pricingPolicy.financialPct}% + management ${pricingPolicy.commercialMgmtPct}%`}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-xs text-muted-foreground">{isEs ? 'Coste total paquete' : 'Package total cost'}</p>
                    <p className="text-lg font-semibold">{money(packageCost, currency)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{isEs ? `Precio de equilibrio: ${money(breakEvenPrice, currency)}` : `Break-even price: ${money(breakEvenPrice, currency)}`}</p>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-xs text-muted-foreground">{isEs ? 'Margen sobre precio propuesto' : 'Margin on proposed price'}</p>
                    <p className={`text-lg font-semibold ${margin >= 0 ? 'text-green-600' : 'text-destructive'}`}>{money(margin, currency)}</p>
                    <p className={`text-[11px] mt-1 ${margin >= 0 ? 'text-green-600' : 'text-destructive'}`}>{marginPct.toFixed(1)}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <p>{isEs ? 'Garantia aplicada a Comercio + Ingenieria + Subcontratas' : 'Warranty applied to Comercio + Engineering + Subcontracting'}: {money(pricing.policyCharges.warranty, currency)}</p>
                  <p>{isEs ? 'Estructura aplicada a Comercio' : 'Material structure applied to Comercio'}: {money(pricing.policyCharges.materialStructure, currency)}</p>
                  <p>{isEs ? 'Financiacion aplicada al coste directo' : 'Finance applied to direct cost'}: {money(pricing.policyCharges.financial, currency)}</p>
                  <p>{isEs ? 'Gestion comercial aplicada al coste directo' : 'Commercial management applied to direct cost'}: {money(pricing.policyCharges.commercialMgmt, currency)}</p>
                </div>

                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => onChange(packages.filter((entry) => entry.id !== pkg.id))}>
                    <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                    {isEs ? 'Eliminar paquete' : 'Remove package'}
                  </Button>
                </div>
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}
