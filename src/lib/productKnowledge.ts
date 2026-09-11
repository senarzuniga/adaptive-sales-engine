import type { ProductRecord } from '@/store/DataStore';
import { inferProductCategory, type ProductCatalogMeta, type ProductCostPresetLine, type ProductCompetitorBenchmark } from '@/lib/productCatalog';

const SOLUTIONS_URL = 'https://senarzuniga.github.io/ingesite.github.io/index.html#solutions';
const VIDEO_URL = 'https://ingesitehub.netlify.app/#technology';

type ProductProfile = {
  aliases: string[];
  base: ProductRecord;
  meta: ProductCatalogMeta;
};

const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');

const unitLine = (category: ProductCostPresetLine['category'], lineItem: string, quantity: number, unitCost: number, extra: Partial<ProductCostPresetLine> = {}): ProductCostPresetLine => ({
  category,
  lineItem,
  mode: 'unit',
  quantity,
  unitCost,
  ...extra,
});

const engineeringLine = (lineItem: string, hours: number, hourlyRate: number, role: string): ProductCostPresetLine => ({
  category: 'engineering',
  lineItem,
  mode: 'engineering',
  hours,
  hourlyRate,
  role,
});

const installationLine = (lineItem: string, days: number, resources: number, unitCost: number, extra: Partial<ProductCostPresetLine> = {}): ProductCostPresetLine => ({
  category: 'installation',
  lineItem,
  mode: 'installation',
  days,
  resources,
  unitCost,
  ...extra,
});

const competitor = (name: string, offer: string, performance: string, marketFit: number, fitGap: string, gainFitActions: string[]): ProductCompetitorBenchmark => ({
  name,
  offer,
  performance,
  marketFit,
  fitGap,
  gainFitActions,
});

const SR1400_VARIABLE_LINES: ProductCostPresetLine[] = [
  unitLine('materials', 'CADENA', 160, 163.45, { scalesWithLength: true, unitsPerLengthM: 2 }),
  unitLine('materials', 'CHAPAS', 64, 75, { scalesWithLength: true, unitsPerLengthM: 0.8 }),
  unitLine('materials', 'BRAZOS LARGO', 80, 5.35, { scalesWithLength: true, unitsPerLengthM: 1 }),
  unitLine('materials', 'BRAZOS CORTOS', 80, 2.12, { scalesWithLength: true, unitsPerLengthM: 1 }),
  unitLine('materials', 'SOMBRERO', 32, 12, { scalesWithLength: true, unitsPerLengthM: 0.4 }),
  unitLine('materials', 'DESLIDUR LARGO', 160, 9, { scalesWithLength: true, unitsPerLengthM: 2 }),
  unitLine('materials', 'DESLIDUR CORTO', 480, 6.5, { scalesWithLength: true, unitsPerLengthM: 6 }),
];

const SR1400_FIXED_LINES: ProductCostPresetLine[] = [
  unitLine('materials', 'UNION CADENA', 5, 44.95),
  unitLine('materials', 'PINON', 1, 595.25),
  unitLine('materials', 'BOMBA DE ENGRASE', 1, 800),
  unitLine('materials', 'CILINDRO', 1, 300),
  unitLine('materials', 'CEPILLO', 1, 200),
  unitLine('materials', 'CHARNELA HEMBRA', 1, 35),
  unitLine('materials', 'CHARNELA MACHO', 1, 46),
  unitLine('materials', 'CONTRACHARNELA', 1, 40),
  unitLine('materials', 'CODO', 1, 7),
  unitLine('materials', 'VALVULA', 1, 51),
  unitLine('materials', 'SILENCIADOR', 1, 3),
  unitLine('materials', 'MATERIAL FERRETERIA 1 KW', 1, 500),
  unitLine('materials', 'TACOS', 10, 1),
  unitLine('materials', 'MOTOR 5 KW', 1, 363.6),
  unitLine('materials', 'REDUCTOR PG503PC SIST RETAL SALIDA 65MM', 1, 1677.9),
  unitLine('materials', 'MOTOR REDUCTOR DEL CEPILLO', 1, 255),
  unitLine('materials', 'Electrovalvula', 1, 50),
  unitLine('materials', 'rodamiento 6308 2rs', 2, 8.5),
  unitLine('materials', 'GRUPILLAS', 2, 0.4),
  unitLine('materials', 'SELFOIL', 2, 1.5),
  unitLine('materials', 'MATERIAL ELECTRICO', 1, 2500),
  unitLine('materials', 'GRUPO MANTENIMIENTO NEUMATICO', 1, 150),
  unitLine('subcontracting', 'INSTALACION ELECTRICA', 1, 2000),
  unitLine('subcontracting', 'MECANIZACION TALLER PUNTAS', 1, 3500),
  unitLine('engineering', 'INGENIERIA BASE SR1400', 1, 2500),
  engineeringLine('MONTAJE EN TALLER', 65, 50, 'OPERARIO TALLER'),
];

const PRODUCT_PROFILES: ProductProfile[] = [
  {
    aliases: ['ingetran', 'ingetrans'],
    base: {
      name: 'INGETRANS',
      averageValue: 620000,
      estimatedCost: 534150,
      type: 'integrated intralogistics solution',
      category: 'product',
      characteristics: ['Turnkey transfer and conveyor system', 'High workshop content', 'Installation-intensive deployment'],
      repositories: ['INGECART/PRODUCTO', 'ingesite solutions'],
      validated: true,
      source: 'manual',
      comments: 'Canonical Ingecart product profile with base costing template from commercial notes.',
    },
    meta: {
      productInfoUrl: SOLUTIONS_URL,
      productVideoUrl: VIDEO_URL,
      linkedReports: ['Internal offer benchmark', 'Intralogistics deployment references'],
      costPreset: [
        installationLine('Mech assembly', 28, 4, 650),
        installationLine('Commissioning', 14, 1, 750),
        installationLine('Start-up and training', 28, 2, 700),
        installationLine('Feeding tracks additional', 6, 2, 550),
        installationLine('Conveyor installation', 14, 2, 550),
        unitLine('materials', 'Material electrico', 1, 135000),
        unitLine('materials', 'Software', 1, 96000),
        unitLine('materials', 'Fabricacion transfer carenado', 1, 87000),
        unitLine('subcontracting', 'Comercio', 1, 25000),
        unitLine('materials', 'Rampa y entrada', 1, 50000),
        unitLine('materials', 'Seguridad', 1, 35000),
        unitLine('materials', 'Caldereria', 1, 3000),
        unitLine('materials', 'Catenaria', 1, 20000),
        unitLine('materials', 'Rieles', 1, 20000),
        unitLine('indirect', 'CE', 1, 3750),
        unitLine('materials', 'Vallado perimetral', 1, 3400),
        engineeringLine('Gestion de proyecto', 120, 70, 'GESTION DE PROYECTO'),
        engineeringLine('Director ing. mecanica', 150, 85, 'DIRECTOR ING. MECANICA'),
        engineeringLine('Director ing. electrica', 150, 85, 'DIRECTOR ING. ELECTRICA'),
        engineeringLine('Control proyecto', 100, 68, 'CONTROL PROYECTO'),
        engineeringLine('Director taller', 150, 60, 'DIRECTOR TALLER'),
        engineeringLine('Operario taller', 550, 45, 'OPERARIO TALLER'),
        engineeringLine('Ing mecanico', 300, 65, 'ING MECANICO'),
      ],
      competitors: [
        competitor('Mecalux', 'Automated transfer and rail logistics', 'High warehouse automation depth and robust installed base.', 76, 'Can win on standardized logistics scope but less corrugator specialization.', ['Emphasize corrugated-specific integration', 'Bundle commissioning and training', 'Use reference layouts in similar plants']),
        competitor('SSI Schaefer', 'Rail and shuttle intralogistics', 'Strong enterprise software and global execution footprint.', 74, 'Competes strongly in software orchestration and scale.', ['Show faster adaptation to corrugated workflows', 'Quantify reduced manual handling', 'Lead with plant-specific engineering evidence']),
      ],
      marketFitNotes: ['Strong fit when customers need turnkey intralogistics around corrugated flow.', 'Market fit increases with reference plants and quantified labor reduction.'],
      fitImprovementActions: ['Attach ROI on labor and safety savings.', 'Position Ingecart as a corrugated process expert, not only an equipment supplier.'],
    },
  },
  {
    aliases: ['carriles motorizados', 'motorized rails'],
    base: {
      name: 'CARRILES MOTORIZADOS', averageValue: 145000, estimatedCost: 96213, type: 'equipment line', category: 'product',
      characteristics: ['10 units / 16 meter reference', 'Compact intralogistics scope', 'Margin-sensitive standard product'], repositories: ['INGECART/PRODUCTO'], validated: true, source: 'manual', comments: 'Base scenario from 10-unit, 16-meter costing note.'
    },
    meta: {
      productInfoUrl: SOLUTIONS_URL, productVideoUrl: VIDEO_URL,
      costPreset: [
        installationLine('Installation', 6, 2, 550),
        unitLine('materials', 'Concepto 1', 1, 40000), unitLine('materials', 'Concepto 2', 1, 11297), unitLine('materials', 'Concepto 3', 1, 3000), unitLine('materials', 'Concepto 4', 1, 8200), unitLine('materials', 'Concepto 5', 1, 1516), unitLine('materials', 'Concepto 6', 1, 13500), unitLine('materials', 'Concepto 7', 1, 10000), unitLine('engineering', 'Correccion horas de ingenieria', 1, -17000),
        engineeringLine('Gestion de proyecto', 40, 70, 'GESTION DE PROYECTO'), engineeringLine('Director ing. mecanica', 40, 85, 'DIRECTOR ING. MECANICA'), engineeringLine('Director ing. electrica', 20, 85, 'DIRECTOR ING. ELECTRICA'), engineeringLine('Control proyecto', 30, 68, 'CONTROL PROYECTO'), engineeringLine('Ing mecanico', 70, 65, 'ING MECANICO'),
      ],
      competitors: [competitor('Interroll', 'Motorized rail conveyor modules', 'Standardized modules with fast deployment in distribution environments.', 71, 'Less tailored to heavy corrugated plant flows.', ['Stress plant customization', 'Bundle installation and safety adaptation'])],
      marketFitNotes: ['Good fit in retrofit projects with fast payback requirements.'],
      fitImprovementActions: ['Offer modular upgrade path and clear maintenance plan.'],
    },
  },
  {
    aliases: ['amr intralogistics', 'amr gestion desperdico area corrugado'],
    base: {
      name: 'AMR GESTION DESPERDICIO AREA CORRUGADO', averageValue: 330000, estimatedCost: 231716, type: 'innovation solution', category: 'product',
      characteristics: ['AMR turnkey installation', 'Waste management in corrugated area', 'KUKA mobile robotics integration'], repositories: ['INGECART/PRODUCTO', 'ingesite solutions'], validated: true, source: 'manual', comments: 'AMR waste management baseline with turnkey installation and electrical integration.'
    },
    meta: {
      productInfoUrl: SOLUTIONS_URL, productVideoUrl: VIDEO_URL,
      costPreset: [
        installationLine('AMR intralogistics turnkey installation', 25, 3, 650),
        unitLine('materials', 'Kuka Unidad AMR', 2, 41607.75), unitLine('engineering', 'Sifise Ingenieria electrica', 1, 35000), unitLine('materials', 'Jaulas linea ondular hierro', 6, 10200), unitLine('engineering', 'Jaulas mano de obra taller', 6, 7800), unitLine('materials', 'Jaulas pintura', 6, 2400), unitLine('materials', 'Jaulas conversion hierro', 2, 3400), unitLine('engineering', 'Jaulas mano obra', 2, 1600), unitLine('materials', 'Jaulas pintura conversion', 2, 400), unitLine('materials', 'Fabricacion tridente material', 2, 22000), unitLine('subcontracting', 'Utillaje AMR', 1, 8500), unitLine('materials', 'Estacion de pesaje', 1, 8000), unitLine('indirect', 'Certificaciones seguridad otros', 1, 4000), unitLine('materials', 'Material WIFI', 1, 3500),
        engineeringLine('Director ing. mecanica', 40, 85, 'DIRECTOR ING. MECANICA'), engineeringLine('Director ing. electrica', 60, 85, 'DIRECTOR ING. ELECTRICA'), engineeringLine('Control proyecto', 40, 68, 'CONTROL PROYECTO'), engineeringLine('Director taller', 40, 60, 'DIRECTOR TALLER'), engineeringLine('Ing mecanico', 100, 65, 'ING MECANICO'),
      ],
      competitors: [competitor('KUKA partner integrators', 'Generic AMR logistics cells', 'Strong robotics know-how, often weaker in corrugated process context.', 79, 'Comparable robotics stack but less process-native positioning.', ['Highlight corrugated waste-flow know-how', 'Use turnkey safety and WiFi readiness as differentiators'])],
      marketFitNotes: ['Fit grows when waste movement and safety automation are critical pain points.'],
      fitImprovementActions: ['Quantify forklift reduction and safety gains.', 'Demonstrate integration with plant routing and KPIs.'],
    },
  },
  {
    aliases: ['amr wip management'],
    base: { name: 'AMR WIP MANAGEMENT', averageValue: 430000, estimatedCost: 351716, type: 'innovation solution', category: 'product', characteristics: ['AMR WIP logistics orchestration', 'Configurable AMR fleet sizing', 'Turnkey intralogistics installation'], repositories: ['INGECART/PRODUCTO', 'ingesite solutions'], validated: true, source: 'manual', comments: 'Uses scalable AMR template with configurable unit quantities for WIP transport.' },
    meta: {
      productInfoUrl: SOLUTIONS_URL, productVideoUrl: VIDEO_URL, configurableByLength: false,
      costPreset: [
        installationLine('AMR intralogistics turnkey installation', 30, 3, 650),
        unitLine('materials', 'Kuka Unidad AMR', 4, 41607.75), unitLine('engineering', 'Sifise Ingenieria electrica', 1, 50000), unitLine('materials', 'Jaulas linea ondular hierro', 20, 10200), unitLine('engineering', 'Jaulas mano de obra taller', 20, 7800), unitLine('materials', 'Jaulas pintura', 20, 2400), unitLine('materials', 'Jaulas conversion hierro', 10, 3400), unitLine('engineering', 'Jaulas mano obra', 10, 1600), unitLine('materials', 'Jaulas pintura conversion', 10, 400), unitLine('materials', 'Fabricacion tridente material', 10, 22000), unitLine('subcontracting', 'Utillaje AMR', 6, 8500), unitLine('materials', 'Estacion de pesaje', 6, 8000), unitLine('indirect', 'Certificaciones seguridad otros', 2, 4000), unitLine('materials', 'Material WIFI', 6, 3500),
        engineeringLine('Director ing. mecanica', 40, 85, 'DIRECTOR ING. MECANICA'), engineeringLine('Director ing. electrica', 60, 85, 'DIRECTOR ING. ELECTRICA'), engineeringLine('Control proyecto', 40, 68, 'CONTROL PROYECTO'), engineeringLine('Director taller', 40, 60, 'DIRECTOR TALLER'), engineeringLine('Ing mecanico', 100, 65, 'ING MECANICO'),
      ],
      competitors: [competitor('Geek+', 'AMR WIP logistics', 'Mature fleet management and standard AMR orchestration.', 72, 'Stronger generic fleet scale, weaker corrugated-specific engineering.', ['Differentiate on turnkey plant adaptation', 'Present hybrid mechanical + AMR solution scope'])],
      marketFitNotes: ['Fit improves with larger WIP complexity and multi-zone movement.'],
      fitImprovementActions: ['Show throughput simulation and congestion reduction.', 'Use plant-specific ROI and safety KPIs.'],
    },
  },
  {
    aliases: ['sr1400', 'sr 1400'],
    base: { name: 'SR1400', averageValue: 95000, estimatedCost: 55111, type: 'equipment line', category: 'product', characteristics: ['Length-configurable scrap conveyor', '80 meter standard cost model', 'Installation can be toggled per offer'], repositories: ['INGECART/PRODUCTO'], validated: true, source: 'manual', comments: 'Length-based cost logic derived from 30m, 50m and 80m reference scenarios.' },
    meta: {
      productInfoUrl: SOLUTIONS_URL, productVideoUrl: VIDEO_URL, configurableByLength: true, defaultLengthM: 80,
      costPreset: [...SR1400_VARIABLE_LINES, ...SR1400_FIXED_LINES, installationLine('SR1400 installation', 8, 2, 550, { optional: true })],
      competitors: [competitor('Runtech', 'Trim conveying systems', 'Strong paper and board waste handling references.', 78, 'Comparable performance in standard scrap evacuation.', ['Lead with modular length-based configurability', 'Quantify easier integration into Ingecart lines']), competitor('QIPC-EAE', 'Waste extraction and trim systems', 'Good automation references in printing and corrugated.', 74, 'Broad automation brand may win on perception.', ['Show lower integration friction and tailored corrugated engineering'])],
      marketFitNotes: ['Fit depends on conveyor length, layout constraints, and maintenance simplicity.'],
      fitImprovementActions: ['Tune the proposal by exact meter count and layout.', 'Use maintenance and cleaning simplicity as a sales argument.'],
    },
  },
  {
    aliases: ['transfer car conveyor system intralogistics', 'transfer car + conveyor system intralogistics', 'transfer car'],
    base: { name: 'TRANSFER CAR + CONVEYOR SYSTEM INtralogistics', averageValue: 285000, estimatedCost: 201350, type: 'integrated intralogistics solution', category: 'product', characteristics: ['Transfer car plus conveyor bundle', '80 meter installation reference', 'High mechanical engineering scope'], repositories: ['INGECART/PRODUCTO'], validated: true, source: 'manual', comments: 'Integrated transfer and conveyor intralogistics baseline.' },
    meta: {
      productInfoUrl: SOLUTIONS_URL, productVideoUrl: VIDEO_URL,
      costPreset: [installationLine('Installation', 8, 2, 600), unitLine('materials', 'Transfer', 1, 22000), unitLine('materials', '7 conveyor', 1, 6000), unitLine('materials', 'Vahley', 1, 4000), unitLine('materials', 'Railes', 1, 57000), engineeringLine('Gestion de proyecto', 80, 70, 'GESTION DE PROYECTO'), engineeringLine('Director ing. mecanica', 350, 85, 'DIRECTOR ING. MECANICA'), engineeringLine('Director ing. electrica', 270, 85, 'DIRECTOR ING. ELECTRICA'), engineeringLine('Operario taller', 800, 45, 'OPERARIO TALLER')],
      competitors: [competitor('Dematic', 'Transfer car conveyor systems', 'Large-scale conveyor references and controls stack.', 73, 'Very strong in standard logistics environments.', ['Stress customization for corrugated loads', 'Sell bundled mechanical + field service capability'])],
      marketFitNotes: ['High fit in projects that need plant-to-plant or zone-to-zone heavy load movement.'],
      fitImprovementActions: ['Position as a bundle with project execution certainty.', 'Include layout simulation and site readiness scope.'],
    },
  },
  {
    aliases: ['plug and play palletizer'],
    base: { name: 'PLUG AND PLAY PALLETIZER', averageValue: 210000, estimatedCost: 153100, type: 'core equipment', category: 'product', characteristics: ['Compact palletizing cell', 'Fast deployment', 'Low engineering complexity compared to turnkey systems'], repositories: ['INGECART/PRODUCTO', 'ingesite solutions'], validated: true, source: 'manual', comments: 'Plug and play palletizer with simple installation footprint.' },
    meta: {
      productInfoUrl: SOLUTIONS_URL, productVideoUrl: VIDEO_URL,
      costPreset: [installationLine('Installation', 7, 1, 650), unitLine('materials', 'Sifise plug and play', 1, 137000), engineeringLine('Gestion de proyecto', 80, 70, 'GESTION DE PROYECTO'), engineeringLine('Director ing. mecanica', 50, 85, 'DIRECTOR ING. MECANICA'), engineeringLine('Director ing. electrica', 100, 85, 'DIRECTOR ING. ELECTRICA')],
      competitors: [competitor('Columbia/Okura', 'Standard palletizer cell', 'Strong standard palletizing performance and references.', 75, 'Competes well where standard throughput dominates.', ['Sell faster customization and integration into complete end-of-line flow'])],
      marketFitNotes: ['Fit is strongest in quick-win end-of-line automation projects.'],
      fitImprovementActions: ['Bundle with service and spare parts plan.', 'Use faster ROI than full turnkey alternatives.'],
    },
  },
  {
    aliases: ['easy pack'],
    base: { name: 'EASY PACK', averageValue: 285000, estimatedCost: 211650, type: 'core equipment', category: 'product', characteristics: ['Pack automation cell', 'Predefined installation footprint', 'Balanced engineering and procurement effort'], repositories: ['INGECART/PRODUCTO', 'ingesite solutions'], validated: true, source: 'manual', comments: 'Easy Pack baseline from commercial costing note.' },
    meta: {
      productInfoUrl: SOLUTIONS_URL, productVideoUrl: VIDEO_URL,
      costPreset: [installationLine('Installation', 7, 1, 650), unitLine('materials', 'DGM Ingepack', 1, 195000), engineeringLine('Gestion de proyecto', 80, 70, 'GESTION DE PROYECTO'), engineeringLine('Director ing. mecanica', 100, 85, 'DIRECTOR ING. MECANICA'), engineeringLine('Director ing. electrica', 100, 85, 'DIRECTOR ING. ELECTRICA'), engineeringLine('Ing mecanico', 100, 65, 'ING MECANICO')],
      competitors: [competitor('Mosca', 'Packaging automation cell', 'Strong packaging brand with repeatability in standard cells.', 70, 'May win on brand in simple applications.', ['Use integration and lifecycle support as core differentiator'])],
      marketFitNotes: ['Fit improves when the customer values an integrated plant solution over standalone equipment.'],
      fitImprovementActions: ['Connect the product to upstream/downstream flow gains.', 'Use references where packing automation removed labor bottlenecks.'],
    },
  },
];

const profileByAlias = new Map(PRODUCT_PROFILES.flatMap((profile) => profile.aliases.map((alias) => [normalize(alias), profile] as const)));

export const getProductProfile = (name: string) => profileByAlias.get(normalize(name));

export function mergeProductWithKnowledge(product: ProductRecord): ProductRecord {
  const profile = getProductProfile(product.name || '');
  if (!profile) return product;
  const meta = profile.meta;
  return {
    ...profile.base,
    ...product,
    category: inferProductCategory(product.type || profile.base.type, product.category || profile.base.category),
    characteristics: product.characteristics && product.characteristics.length > 0 ? product.characteristics : profile.base.characteristics,
    repositories: Array.from(new Set([...(profile.base.repositories || []), ...(meta.linkedReports || []), ...(product.repositories || [])])),
    estimatedCost: Number(product.estimatedCost || profile.base.estimatedCost || 0),
    averageValue: Number(product.averageValue || profile.base.averageValue || 0),
    validated: product.validated ?? profile.base.validated,
    source: product.source || profile.base.source,
    productInfoUrl: product.productInfoUrl || meta.productInfoUrl,
    productVideoUrl: product.productVideoUrl || meta.productVideoUrl,
    linkedReports: product.linkedReports && product.linkedReports.length > 0 ? product.linkedReports : meta.linkedReports,
    defaultLengthM: Number(product.defaultLengthM || meta.defaultLengthM || 0) || undefined,
    configurableByLength: product.configurableByLength ?? meta.configurableByLength,
    costPreset: product.costPreset && product.costPreset.length > 0 ? product.costPreset : meta.costPreset,
    competitors: product.competitors && product.competitors.length > 0 ? product.competitors : meta.competitors,
    marketFitNotes: product.marketFitNotes && product.marketFitNotes.length > 0 ? product.marketFitNotes : meta.marketFitNotes,
    fitImprovementActions: product.fitImprovementActions && product.fitImprovementActions.length > 0 ? product.fitImprovementActions : meta.fitImprovementActions,
  };
}

export function buildSeedProductCatalog(products: ProductRecord[]): ProductRecord[] {
  const merged = new Map<string, ProductRecord>();
  PRODUCT_PROFILES.forEach((profile) => merged.set(normalize(profile.base.name), mergeProductWithKnowledge(profile.base)));
  products.forEach((product) => merged.set(normalize(product.name), mergeProductWithKnowledge(product)));
  return Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export function estimateProductPresetCost(product: ProductRecord, lengthM?: number, includeInstallation = true): number {
  return buildOfferCostPreset(product, { lengthM, includeInstallation }).reduce((sum, line) => {
    if (line.mode === 'engineering') return sum + (line.hours || 0) * (line.hourlyRate || 0);
    if (line.mode === 'installation') return sum + (line.days || 0) * (line.resources || 0) * (line.unitCost || 0);
    return sum + (line.quantity || 0) * (line.unitCost || 0);
  }, 0);
}

export function buildOfferCostPreset(product: ProductRecord, options: { lengthM?: number; includeInstallation?: boolean } = {}): ProductCostPresetLine[] {
  const normalized = mergeProductWithKnowledge(product);
  const metaLines = normalized.costPreset || [];
  const defaultLength = normalized.defaultLengthM || 80;
  const lengthM = Number(options.lengthM || defaultLength || 0) || defaultLength;
  const includeInstallation = options.includeInstallation !== false;

  return metaLines
    .filter((line) => includeInstallation || line.category !== 'installation')
    .map((line) => {
      if (!line.scalesWithLength || !line.unitsPerLengthM) return { ...line };
      return {
        ...line,
        quantity: Number((lengthM * line.unitsPerLengthM).toFixed(2)),
      };
    });
}

export function buildProductIntelligence(product: ProductRecord, marketFitScore = 0) {
  const normalized = mergeProductWithKnowledge(product);
  const competitors = normalized.competitors || [];
  const fitScore = Math.round(Math.max(marketFitScore, competitors.length > 0 ? competitors.reduce((sum, item) => sum + item.marketFit, 0) / competitors.length : 0));
  const fitSummary = fitScore >= 75
    ? 'Strong fit. Protect differentiation and prove performance with customer references.'
    : fitScore >= 55
      ? 'Moderate fit. Strengthen the value case and sharpen vertical positioning.'
      : 'Weak fit. Rework the offer framing and add evidence before scaling pipeline effort.';

  return {
    product: normalized,
    fitScore,
    fitSummary,
    competitors,
    marketFitNotes: normalized.marketFitNotes || [],
    fitImprovementActions: normalized.fitImprovementActions || [],
  };
}
