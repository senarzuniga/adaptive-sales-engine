import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
  type ISectionOptions,
} from 'docx';
import { buildProductIntelligence, mergeProductWithKnowledge } from '@/lib/productKnowledge';
import {
  DEFAULT_OFFER_SECTIONS,
  INSTALLATION_ASSOCIATED_COSTS_TEXT,
  INSTALLATION_CUSTOMER_SUPPORT_TEXT,
  INSTALLATION_SERVICE_DELIVERABLES,
  buildDefaultCommercialTerms,
  buildDeliveryTermsText,
  buildEquipmentIncotermText,
  buildPackageContentsText,
  buildPackageExecutiveDetail,
  buildPaymentTermsText,
  buildValidityTermsText,
  buildWarrantyTermsText,
  calculateItemDirectCost,
  calculatePackageDirectCost,
  isInstallationPackage,
  itemLabel,
  type OfferCommercialTerms,
  type OfferPackageDraft,
} from '@/lib/offerPackages';
import type { CompanyProfile, ProductRecord } from '@/store/DataStore';

const ORANGE = 'F36B21';
const DARK = '171717';
const MID_GREY = '5C5C5C';
const LIGHT = 'F7F7F7';
const WHITE = 'FFFFFF';
const DULL_BORDER = 'D0D0D0';

const HEADER_LOGO_SIZE = { width: 101, height: 101 };
const COVER_IMAGE_SIZE = { width: 635, height: 357 };
const INGECART_TEMPLATE_ASSETS = {
  headerLogo: 'offer-assets/ingecart/header-logo.png',
  coverImage: 'offer-assets/ingecart/cover-reference.jpeg',
} as const;

type Row = Record<string, any>;
type ItemRow = Row & { id: string };
type CostRow = Row & { offer_item_id?: string };
type BorderColor = typeof WHITE | typeof DULL_BORDER;

export type OfferWordLanguage = 'en' | 'es';

type ScopeRow = {
  label: string;
  scope: string;
  directCost: number;
  proposalPrice: number;
  executiveDetail: string;
  itemNames: string[];
  installationPackage: boolean;
};

export interface OfferWordExportInput {
  offer: Row;
  items: Row[];
  costRows: Row[];
  scenarios?: Row[];
  offerScore?: Row | null;
  company: CompanyProfile;
  products: ProductRecord[];
  pricingPolicy?: OfferCostPolicy | null;
  packages?: OfferPackageDraft[];
  commercialTerms?: OfferCommercialTerms | null;
  language?: OfferWordLanguage;
}

export interface OfferWordTemplateAssets {
  headerLogo?: { data: Uint8Array; type: 'png' | 'jpg' };
  coverImage?: { data: Uint8Array; type: 'png' | 'jpg' };
}

const fmtCurrency = (value: number, currency = 'EUR', language: OfferWordLanguage = 'en') => new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));
const fmtDate = (value: string | undefined, language: OfferWordLanguage = 'en') => value ? new Date(value).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
const text = (value: unknown) => String(value || '').trim();
const bullets = (values: Array<string | undefined | null>) => values.map((value) => text(value)).filter(Boolean);
const isIngecartTemplate = (input: OfferWordExportInput) => /ingecart/i.test([input.company.company_name, input.offer.company_name, input.offer.company].map((value) => text(value)).join(' '));

const heading = (level: 1 | 2, label: string) => new Paragraph({
  text: label,
  heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
  thematicBreak: false,
  spacing: { before: level === 1 ? 220 : 140, after: 80 },
});

const normal = (value: string) => new Paragraph({
  children: [new TextRun({ text: value, font: 'Arial', size: 19, color: DARK })],
  spacing: { after: 90 },
});

const bullet = (value: string) => new Paragraph({
  text: value,
  bullet: { level: 0 },
  spacing: { after: 50 },
});

const borders = (color: BorderColor = DULL_BORDER, style: (typeof BorderStyle)[keyof typeof BorderStyle] = BorderStyle.SINGLE, size = 1) => ({
  top: { style, size, color },
  bottom: { style, size, color },
  left: { style, size, color },
  right: { style, size, color },
});

const cell = (
  value: string,
  options: {
    fill?: string;
    color?: string;
    bold?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    borderColor?: BorderColor;
    borderStyle?: (typeof BorderStyle)[keyof typeof BorderStyle];
    borderSize?: number;
  } = {},
) => new TableCell({
  shading: options.fill ? { fill: options.fill, color: 'auto', type: ShadingType.CLEAR } : undefined,
  borders: borders(options.borderColor || (options.fill === DARK || options.fill === ORANGE ? WHITE : DULL_BORDER), options.borderStyle, options.borderSize),
  children: [new Paragraph({ alignment: options.align, children: [new TextRun({ text: value, bold: options.bold, color: options.color || DARK, font: 'Arial', size: 17 })] })],
});

const borderlessCell = (children: Paragraph[]) => new TableCell({
  borders: borders(WHITE, BorderStyle.NONE, 0),
  children,
});

const gridTable = (headers: string[], rows: string[][], widths: number[], highlightLast = false) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    new TableRow({ tableHeader: true, children: headers.map((header) => cell(header, { fill: DARK, color: WHITE, bold: true, borderColor: WHITE })) }),
    ...rows.map((row, index) => new TableRow({ children: row.map((value, cellIndex) => cell(value, { fill: highlightLast && index === rows.length - 1 ? ORANGE : index % 2 ? LIGHT : undefined, color: highlightLast && index === rows.length - 1 ? WHITE : DARK, bold: highlightLast && index === rows.length - 1 ? true : cellIndex === 0, align: cellIndex === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT, borderColor: highlightLast && index === rows.length - 1 ? WHITE : DULL_BORDER })) })),
  ],
  columnWidths: widths,
});

const coverTable = (input: OfferWordExportInput, language: OfferWordLanguage = 'en') => {
  const isEs = language === 'es';
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      [isEs ? 'Cliente' : 'Customer', text(input.offer.customer_name) || text(input.company.company_name)],
      [isEs ? 'Proyecto' : 'Project', text(input.offer.title) || (isEs ? 'Propuesta comercial' : 'Commercial proposal')],
      [isEs ? 'Referencia de oferta' : 'Proposal reference', text(input.offer.offer_number) || (isEs ? 'Borrador de oferta' : 'Offer draft')],
      [isEs ? 'Fecha' : 'Date', fmtDate(input.offer.updated_at || input.offer.created_at, language)],
      [isEs ? 'Base comercial' : 'Commercial basis', `${text(input.offer.currency) || 'EUR'} | ${isEs ? 'Suministro de equipos y servicios segun el alcance y las condiciones comerciales configuradas.' : 'Equipment and services according to the configured scope and commercial conditions.'}`],
    ].map(([label, value]) => new TableRow({
      children: [
        cell(label, { fill: DARK, color: WHITE, bold: true, borderColor: WHITE, borderSize: 4 }),
        cell(value, { fill: LIGHT, bold: label === 'Project' || label === 'Proyecto' || label === 'Proposal reference' || label === 'Referencia de oferta', borderColor: WHITE, borderSize: 4 }),
      ],
    })),
    columnWidths: [2835, 6520],
  });
};

const buildCoverTitle = (input: OfferWordExportInput) => {
  const primary = text(input.offer.title) || input.items.map((item) => text(item.item_name || item.name)).filter(Boolean).join(' / ') || 'COMMERCIAL PROPOSAL';
  const secondary = text(input.offer.project_description) || 'AUTOMATION PROPOSAL';
  return { primary: primary.toUpperCase(), secondary: secondary.toUpperCase() };
};

const buildCoverRibbon = (input: OfferWordExportInput) => input.items.map((item) => text(item.item_name || item.name)).filter(Boolean).join('  |  ') || 'INGETRANS  |  REEL CONVEYORS  |  RFID  |  AMR SCRAP LOGISTICS';

const getAssociatedCostsText = (language: OfferWordLanguage) => language === 'es'
  ? 'Los costes asociados incluyen hotel, vuelos, transporte local y dietas segun la base de alcance aprobada. Las duraciones indicadas se entienden como dias laborables y asumen acceso continuo a planta preparada, medios de elevacion disponibles y apoyo puntual del cliente.'
  : INSTALLATION_ASSOCIATED_COSTS_TEXT;

const getCustomerSupportText = (language: OfferWordLanguage) => language === 'es'
  ? 'El cliente debera proporcionar soporte mecanico y electrico adicional, asi como gruas y equipos auxiliares necesarios para la ejecucion.'
  : INSTALLATION_CUSTOMER_SUPPORT_TEXT;

const getServiceDeliverables = (language: OfferWordLanguage) => language === 'es'
  ? [
      'Supervision mecanica y apoyo al montaje de acuerdo con la matriz de responsabilidades.',
      'Cold commissioning, verificaciones de I/O y validacion de handshake entre estaciones.',
      'Puesta en marcha de software, ajuste de secuencias y pruebas en modo produccion.',
      'Soporte a la interfaz RFID/MES dentro del protocolo y alcance de datos acordados.',
      'Configuracion de AMR, rutas y estaciones bajo condiciones reales de planta.',
      'Formacion de operacion y mantenimiento para ciclo normal, alarmas y recuperacion.',
      'Soporte SAT y cierre de punch-list acordado.',
    ]
  : [...INSTALLATION_SERVICE_DELIVERABLES];

const normalizeNarrative = (value: string) => value.replace(/\s*\|\s*/g, '; ').replace(/\s+/g, ' ').trim();

const withTrailingPeriod = (value: string) => {
  const normalized = normalizeNarrative(value);
  if (!normalized) return '';
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
};

const buildScopeExecutiveNarrative = (scopeRow: ScopeRow, language: OfferWordLanguage) => {
  const base = withTrailingPeriod(scopeRow.executiveDetail || scopeRow.scope);
  if (base) return base;
  return language === 'es'
    ? 'Resumen ejecutivo del paquete pendiente de ajuste final en la emision comercial.'
    : 'Executive package summary pending final commercial release.';
};

const buildExecutiveSummaryPoints = ({
  customer,
  offerTitle,
  scopeRows,
  currency,
  score,
  installationRows,
  language,
}: {
  customer: string;
  offerTitle: string;
  scopeRows: ScopeRow[];
  currency: string;
  score: Row | null;
  installationRows: CostRow[];
  language: OfferWordLanguage;
}) => {
  const isEs = language === 'es';
  const firstRows = scopeRows.slice(0, 3).map((row) => `${row.label}: ${row.scope || (isEs ? 'alcance configurado' : 'configured scope')}`);
  return bullets([
    isEs ? `Cliente: ${customer}. Proyecto: ${offerTitle || 'Propuesta comercial'}.` : `Customer: ${customer}. Project: ${offerTitle || 'Commercial proposal'}.`,
    isEs ? `La estructura comercial se presenta en ${currency} y ordena el alcance en ${scopeRows.length} paquete(s) ejecutivos.` : `The commercial structure is presented in ${currency} and organizes the scope into ${scopeRows.length} executive package(s).`,
    firstRows.length > 0 ? (isEs ? `Bloques clave: ${firstRows.join(' | ')}.` : `Key blocks: ${firstRows.join(' | ')}.`) : undefined,
    score ? (isEs ? `Scoring IA de pricing: ${Number(score.global_score || 0).toFixed(0)} / 100. ${text(score.ai_explanation)}` : `AI pricing score: ${Number(score.global_score || 0).toFixed(0)} / 100. ${text(score.ai_explanation)}`) : (isEs ? 'El analisis IA de pricing puede adjuntarse como anexo cuando proceda.' : 'AI pricing analysis can be attached as an annex when available.'),
    installationRows.length > 0 ? (isEs ? 'Los servicios de instalacion, puesta en marcha y soporte de campo quedan integrados con entregables y responsabilidades definidos.' : 'Installation, commissioning and field-support services are integrated with defined deliverables and responsibilities.') : undefined,
  ]);
};

const buildBlockLead = (item: ItemRow, product: ProductRecord | null, language: OfferWordLanguage) => {
  const dossier = product?.technicalDossier;
  return withTrailingPeriod(text(item.description) || text(dossier?.valueProposition) || text(product?.comments) || (language === 'es' ? 'Bloque configurado desde la oferta y pendiente de cierre final de ingenieria.' : 'Configured scope generated from the offer builder and subject to final engineering closure.'));
};

const buildFunctionalScopeLines = (item: ItemRow, product: ProductRecord | null, language: OfferWordLanguage) => {
  const dossier = product?.technicalDossier;
  const lines = bullets([
    ...(product?.characteristics || []).slice(0, 4),
    ...(dossier?.applications || []).slice(0, 2).map((application) => language === 'es' ? `Aplicacion objetivo: ${application}` : `Target application: ${application}`),
    text(item.description),
  ]);
  return lines.length > 0 ? lines.slice(0, 6) : [language === 'es' ? 'Alcance funcional y criterios de interfaz a validar durante la ingenieria de detalle.' : 'Functional scope and interface criteria to be validated during detailed engineering.'];
};

const buildPerformanceLines = (product: ProductRecord | null, language: OfferWordLanguage) => {
  const dossier = product?.technicalDossier;
  const specLines = (dossier?.technicalSpecifications || []).slice(0, 5).map((spec) => `${spec.parameter}: ${spec.value}`);
  const kpiLines = (dossier?.performanceKpis || []).slice(0, 2).map((kpi) => language === 'es' ? `KPI de referencia: ${kpi}` : `Reference KPI: ${kpi}`);
  const lines = bullets([...specLines, ...kpiLines]);
  return lines.length > 0 ? lines : [language === 'es' ? 'La base tecnica final se cerrara con layout aprobado, matriz de cargas, utilidades disponibles y documentos de interfaz del proyecto.' : 'The final technical basis will be closed against the approved layout, load matrix, available utilities and project interface documents.'];
};

const buildBusinessValueLines = (product: ProductRecord | null, language: OfferWordLanguage) => {
  const dossier = product?.technicalDossier;
  const intelligence = product ? buildProductIntelligence(product) : null;
  const lines = bullets([
    ...(dossier?.roiFramework || []).slice(0, 3),
    ...(intelligence?.marketFitNotes || []).slice(0, 3),
  ]);
  return lines.length > 0 ? lines : [language === 'es' ? 'La solucion esta planteada para mejorar continuidad operativa, control del flujo, seguridad y robustez de ejecucion.' : 'The solution is positioned to improve operational continuity, flow control, safety and execution robustness.'];
};

const buildExecutionAssumptionLines = (product: ProductRecord | null, language: OfferWordLanguage) => {
  const dossier = product?.technicalDossier;
  const lines = bullets([
    ...(dossier?.risksAndLimits || []).slice(0, 2),
    ...(dossier?.acceptanceCriteria || []).slice(0, 2).map((criterion) => language === 'es' ? `Validacion requerida: ${criterion}` : `Required validation: ${criterion}`),
  ]);
  return lines.length > 0 ? lines : [language === 'es' ? 'Las prestaciones finales quedaran sujetas a validacion de ingenieria, layout aprobado y criterios de aceptacion acordados.' : 'Final performance remains subject to engineering validation, approved layout and agreed acceptance criteria.'];
};

const imageParagraph = (image: { data: Uint8Array; type: 'jpg' | 'png' }, size: { width: number; height: number }) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 80, after: 40 },
  children: [new ImageRun({ type: image.type, data: image.data, transformation: size })],
});

const imageCaption = (value: string) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 90 },
  children: [new TextRun({ text: value, font: 'Arial', size: 15, italics: true, color: MID_GREY })],
});

const buildHeader = (offerRef: string, templateAssets: OfferWordTemplateAssets) => new Header({
  children: [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [6236, 3402],
    rows: [new TableRow({ children: [
      borderlessCell([new Paragraph({ children: templateAssets.headerLogo ? [new ImageRun({ type: templateAssets.headerLogo.type, data: templateAssets.headerLogo.data, transformation: HEADER_LOGO_SIZE })] : [new TextRun({ text: 'INGECART', font: 'Arial', size: 22, bold: true, color: DARK })] })]),
      borderlessCell([new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: offerRef, font: 'Arial', size: 14, bold: true, color: MID_GREY })] })]),
    ] })],
  })],
});

const buildFooter = (customer: string, project: string) => new Footer({
  children: [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [6800, 2800],
    rows: [new TableRow({ children: [
      borderlessCell([new Paragraph({ children: [new TextRun({ text: `CONFIDENTIAL | ${customer}${project ? ` | ${project}` : ''}`, font: 'Arial', size: 14, color: MID_GREY })] })]),
      borderlessCell([new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Page ', font: 'Arial', size: 14, color: MID_GREY }), new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 14, color: MID_GREY }), new TextRun({ text: ' / ', font: 'Arial', size: 14, color: MID_GREY }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 14, color: MID_GREY })] })]),
    ] })],
  })],
});

const buildCommercialConditionsTable = (currency: string, terms: OfferCommercialTerms, language: OfferWordLanguage = 'en') => {
  const isEs = language === 'es';
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [cell(isEs ? 'Elemento comercial' : 'Commercial item', { fill: DARK, color: WHITE, bold: true, borderColor: WHITE }), cell(isEs ? 'Condicion' : 'Condition', { fill: DARK, color: WHITE, bold: true, borderColor: WHITE })] }),
      new TableRow({ children: [cell(isEs ? 'Moneda' : 'Currency', { bold: true }), cell(currency)] }),
      new TableRow({ children: [cell(isEs ? 'Incoterm equipos' : 'Equipment Incoterm', { bold: true }), cell(buildEquipmentIncotermText(terms, language))] }),
      new TableRow({ children: [cell(isEs ? 'Pago' : 'Payment', { bold: true }), cell(buildPaymentTermsText(terms, language))] }),
      new TableRow({ children: [cell(isEs ? 'Entrega' : 'Delivery', { bold: true }), cell(buildDeliveryTermsText(terms, language))] }),
      new TableRow({ children: [cell(isEs ? 'Validez' : 'Validity', { bold: true }), cell(buildValidityTermsText(terms, language))] }),
      new TableRow({ children: [cell(isEs ? 'Garantia' : 'Warranty', { bold: true }), cell(buildWarrantyTermsText(terms, language))] }),
    ],
    columnWidths: [2600, 6755],
  });
};

const buildScopeRows = (input: OfferWordExportInput, scopePriceTotal: number): ScopeRow[] => {
  const isEs = input.language === 'es';
  const items = input.items as ItemRow[];
  const costRows = input.costRows as CostRow[];
  const directTotal = items.reduce((sum, item) => sum + calculateItemDirectCost(item.id, items, costRows), 0);
  const activePackages = (input.packages || []).filter((pkg) => pkg.itemIds.length > 0).sort((a, b) => a.sortOrder - b.sortOrder);
  if (activePackages.length === 0) {
    return items.map((item, index) => {
      const itemCost = calculateItemDirectCost(item.id, items, costRows);
      const share = directTotal > 0 ? itemCost / directTotal : 1 / Math.max(items.length, 1);
      return {
        label: `${String.fromCharCode(65 + index)}. ${text(item.item_name || item.name) || (isEs ? 'Bloque de oferta' : 'Offer block')}`,
        scope: text(item.description) || '-',
        directCost: itemCost,
        proposalPrice: scopePriceTotal * share,
        executiveDetail: text(item.description) || '-',
        itemNames: [text(item.item_name || item.name)].filter(Boolean),
        installationPackage: false,
      };
    });
  }

  const explicitTotal = activePackages.reduce((sum, pkg) => sum + Number(pkg.commercialPrice || 0), 0);
  const useExplicitPrices = explicitTotal > 0;
  const additionalRows = activePackages.map((pkg) => {
    const directCost = calculatePackageDirectCost(pkg, items, costRows);
    const share = directTotal > 0 ? directCost / directTotal : 1 / Math.max(activePackages.length, 1);
    return {
      pkg,
      directCost,
      proposalPrice: useExplicitPrices ? Number(pkg.commercialPrice || 0) : scopePriceTotal * share,
      executiveDetail: buildPackageExecutiveDetail(pkg, items, costRows) || '-',
      scope: buildPackageContentsText(pkg, items) || '-',
      installationPackage: isInstallationPackage(pkg, costRows),
      itemNames: pkg.itemIds.map((itemId) => itemLabel(items.find((item) => item.id === itemId) || { id: itemId })).filter(Boolean),
    };
  });

  const additionalDirect = additionalRows.reduce((sum, row) => sum + row.directCost, 0);
  const additionalPrice = additionalRows.reduce((sum, row) => sum + row.proposalPrice, 0);
  const principalDirect = directTotal - additionalDirect;
  const principalPrice = scopePriceTotal - additionalPrice;
  const packagedItems = new Set(activePackages.flatMap((pkg) => pkg.itemIds));
  const principalItemNames = items.filter((item) => !packagedItems.has(item.id)).map((item) => itemLabel(item)).filter(Boolean);

  const principalRow: ScopeRow = {
    label: isEs ? '1. Paquete principal' : '1. Principal package',
    scope: principalItemNames.length > 0 ? principalItemNames.join('; ') : (isEs ? 'Alcance restante tras los paquetes adicionales' : 'Remaining configured scope after additional packages'),
    directCost: principalDirect,
    proposalPrice: principalPrice,
    executiveDetail: principalItemNames.length > 0 ? principalItemNames.join(' | ') : (isEs ? 'Paquete principal calculado como total de oferta menos paquetes adicionales.' : 'Main package computed as total offer minus additional packages.'),
    itemNames: principalItemNames,
    installationPackage: false,
  };

  return [
    principalRow,
    ...additionalRows.map((row, index) => ({
      label: `${index + 2}. ${text(row.pkg.name) || `Package ${index + 1}`}`,
      scope: row.scope,
      directCost: row.directCost,
      proposalPrice: row.proposalPrice,
      executiveDetail: row.executiveDetail,
      itemNames: row.itemNames,
      installationPackage: row.installationPackage,
    })),
  ];
};

export const buildOfferWordDocument = (input: OfferWordExportInput, templateAssets: OfferWordTemplateAssets = {}) => {
  const sections: ISectionOptions[] = [];
  const items = input.items as ItemRow[];
  const allCostRows = input.costRows as CostRow[];
  const currency = text(input.offer.currency) || 'EUR';
  const commercialTerms = input.commercialTerms || buildDefaultCommercialTerms();
  const language: OfferWordLanguage = input.language === 'es' ? 'es' : 'en';
  const isEs = language === 'es';
  const sectionLabels = isEs ? [
    '11  EJECUCION DEL PROYECTO Y ACEPTACION',
    '11.1 KPI DE ACEPTACION A DEFINIR EN INGENIERIA',
    '12  CONDICIONES COMERCIALES',
    '12.1 Inclusiones de precio',
    '12.2 Exclusiones',
    '12.3 Responsabilidades del cliente',
    '13  GARANTIA Y CONDICIONES GENERALES DE VENTA',
    '14  ACEPTACION DE OFERTA',
  ] : DEFAULT_OFFER_SECTIONS;
  const offerRef = text(input.offer.offer_number) || 'OFFER-DRAFT';
  const customer = text(input.offer.customer_name) || text(input.company.company_name) || 'Customer';
  const score = input.offerScore || null;
  const installationRows = allCostRows.filter((row) => row.category === 'installation' || row.category === 'transport');
  const scenario = (input.scenarios || []).find((item) => item.scenario_type === 'base') || (input.scenarios || [])[0];
  const scopePriceTotal = Number(scenario?.selling_price || input.offer.contract_value || 0);
  const scopeRows = buildScopeRows(input, scopePriceTotal);
  const linkedProducts = items.map((item) => {
    const found = input.products.find((product) => product.name === item.item_name || product.name === item.name);
    return found ? mergeProductWithKnowledge(found) : null;
  });
  const coverTitle = buildCoverTitle(input);
  const coverCaptionText = isIngecartTemplate(input)
    ? (isEs ? 'Plataforma integrada de logistica de bobinas INGECART - imagen de referencia' : 'INGECART integrated reel logistics platform - reference image')
    : (isEs ? 'Imagen de referencia de la solucion configurada' : 'Configured solution reference image');

  sections.push({
    properties: {},
    headers: { default: buildHeader(offerRef, templateAssets) },
    footers: { default: buildFooter(customer, text(input.offer.title) || 'Commercial proposal') },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, shading: { fill: DARK, type: ShadingType.CLEAR, color: 'auto' }, children: [new TextRun({ text: `\n${coverTitle.primary}\n${coverTitle.secondary}\n`, font: 'Arial', size: 34, bold: true, color: WHITE })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, shading: { fill: ORANGE, type: ShadingType.CLEAR, color: 'auto' }, children: [new TextRun({ text: buildCoverRibbon(input), font: 'Arial', size: 18, bold: true, color: WHITE })] }),
      ...(templateAssets.coverImage ? [imageParagraph(templateAssets.coverImage, COVER_IMAGE_SIZE), imageCaption(coverCaptionText)] : []),
      coverTable(input, language),
      heading(1, isEs ? 'CONTENIDOS' : 'CONTENTS'),
      new Paragraph({ children: [new TableOfContents(' ', { hyperlink: true, headingStyleRange: '1-2' })] }),
      heading(1, isEs ? '1  CARTA DE OFERTA' : '1  OFFER LETTER'),
      normal(isEs ? `Estimado equipo de ${customer},` : `Dear ${customer} Team,`),
      normal(isEs
        ? `INGECART presenta la propuesta ${offerRef} para ${text(input.offer.title) || 'el alcance definido del proyecto'}. La oferta consolida alcance, integracion y condiciones comerciales en un formato ejecutivo listo para validacion interna y negociacion final.`
        : `INGECART is pleased to submit proposal ${offerRef} for ${text(input.offer.title) || 'the defined project scope'}. The proposal consolidates scope, integration logic and commercial conditions in an executive format ready for internal validation and final negotiation.`),
      normal(isEs
        ? 'El objetivo de esta emision es ofrecer una propuesta tecnicamente consistente, comercialmente trazable y preparada para minimizar aclaraciones posteriores durante la fase de ingenieria y adjudicacion.'
        : 'The objective of this release is to provide a technically consistent, commercially traceable proposal that minimizes downstream clarifications during engineering and award.'),
      heading(1, isEs ? '2  RESUMEN EJECUTIVO' : '2  EXECUTIVE SUMMARY'),
      ...buildExecutiveSummaryPoints({
        customer,
        offerTitle: text(input.offer.title) || 'Commercial proposal',
        scopeRows,
        currency,
        score,
        installationRows,
        language,
      }).map(bullet),
      heading(1, isEs ? '3  ALCANCE Y ESTRUCTURA COMERCIAL' : '3  SCOPE AND COMMERCIAL STRUCTURE'),
      normal(text(input.offer.project_description) || (isEs ? 'La siguiente estructura comercial resume el alcance configurado, los bloques ejecutivos y los precios de propuesta asociados.' : 'The following commercial structure summarizes the configured scope, executive blocks and associated proposal prices.')),
      gridTable(
        [isEs ? 'Bloque / paquete' : 'Block / package', isEs ? 'Alcance' : 'Scope', isEs ? 'Precio propuesta' : 'Proposal price'],
        [...scopeRows.map((row) => [row.label, row.scope, fmtCurrency(row.proposalPrice, currency, language)]), [isEs ? 'TOTAL PROPUESTA' : 'TOTAL PROPOSAL', '', fmtCurrency(scopeRows.reduce((sum, row) => sum + row.proposalPrice, 0), currency, language)]],
        [2200, 5400, 2000],
        true,
      ),
      ...scopeRows.flatMap((scopeRow, index) => ([
        heading(1, isEs ? `4.${index + 1}  DETALLE EJECUTIVO ${scopeRow.label.toUpperCase()}` : `4.${index + 1}  ${scopeRow.label.toUpperCase()} EXECUTIVE DETAIL`),
        normal(buildScopeExecutiveNarrative(scopeRow, language)),
        ...(scopeRow.itemNames.length > 0 ? [heading(2, isEs ? `4.${index + 1}.1 Elementos incluidos` : `4.${index + 1}.1 Included elements`), ...scopeRow.itemNames.map((value) => bullet(value))] : []),
        ...(scopeRow.installationPackage ? [
          heading(2, isEs ? `4.${index + 1}.2 Base de instalacion` : `4.${index + 1}.2 Installation basis`),
          normal(getAssociatedCostsText(language)),
          normal(getCustomerSupportText(language)),
          heading(2, isEs ? `4.${index + 1}.3 Entregables de servicio` : `4.${index + 1}.3 Service deliverables`),
          ...getServiceDeliverables(language).map((value) => bullet(value)),
        ] : []),
      ])),
      ...items.flatMap((item, index) => {
        const product = linkedProducts[index];
        const intelligence = product ? buildProductIntelligence(product) : null;
        const sectionNo = 5 + index;
        const chapter = `${isEs ? 'BLOQUE' : 'BLOCK'} ${String.fromCharCode(65 + index)} - ${text(item.item_name || item.name) || (isEs ? 'Alcance configurado' : 'Configured scope')}`;
        return [
          heading(1, `${sectionNo}  ${chapter}`),
          normal(buildBlockLead(item, product, language)),
          heading(2, isEs ? `${sectionNo}.1 Alcance funcional` : `${sectionNo}.1 Functional scope`),
          ...buildFunctionalScopeLines(item, product, language).map(bullet),
          heading(2, isEs ? `${sectionNo}.2 Base tecnica y rendimiento` : `${sectionNo}.2 Technical and performance basis`),
          ...buildPerformanceLines(product, language).map(bullet),
          heading(2, isEs ? `${sectionNo}.3 Valor operativo y caso de negocio` : `${sectionNo}.3 Operational value and business case`),
          ...buildBusinessValueLines(product, language).map(bullet),
          heading(2, isEs ? `${sectionNo}.4 Hipotesis de ejecucion y validacion` : `${sectionNo}.4 Execution assumptions and validation`),
          ...buildExecutionAssumptionLines(product, language).map(bullet),
          heading(2, isEs ? `${sectionNo}.5 Base comercial del bloque` : `${sectionNo}.5 Commercial basis of the block`),
          normal(isEs ? 'El precio comercial de este bloque se recoge en el resumen de alcance y estructura comercial de la oferta, sin exponer costes internos ni criterios de formacion de coste.' : 'The commercial price for this block is captured in the scope and commercial structure summary, without exposing internal costs or internal cost-building criteria.'),
          ...(intelligence?.fitImprovementActions && intelligence.fitImprovementActions.length > 0 ? [heading(2, isEs ? `${sectionNo}.6 Posicionamiento comercial` : `${sectionNo}.6 Commercial positioning`), ...intelligence.fitImprovementActions.slice(0, 4).map(bullet)] : []),
        ];
      }),
      heading(1, isEs ? '10  INSTALACION, PUESTA EN MARCHA Y FORMACION' : '10  INSTALLATION, COMMISSIONING AND TRAINING'),
      ...(installationRows.length > 0 ? [
        normal(isEs ? 'Los servicios de campo se presentan como un bloque de ejecucion con entregables, bases de trabajo y responsabilidades compartidas claramente definidos.' : 'Site services are presented as an execution block with clearly defined deliverables, working assumptions and shared responsibilities.'),
        gridTable(
          [isEs ? 'Familia de servicio' : 'Service family', isEs ? 'Descripcion' : 'Description', isEs ? 'Base' : 'Basis'],
          installationRows.map((row) => [text(row.category), text(row.line_item), row.hours ? `${row.hours} h` : row.days ? `${row.days} d / ${row.resources || 0} tech` : `${row.quantity || 1}`]),
          [2200, 5600, 1800],
        ),
        normal(getAssociatedCostsText(language)),
        normal(getCustomerSupportText(language)),
        heading(2, isEs ? '10.1 Entregables de servicio' : '10.1 Service deliverables'),
        ...getServiceDeliverables(language).map((value) => bullet(value)),
      ] : [normal(isEs ? 'No se ha configurado un paquete separado de servicios de campo en esta version de oferta.' : 'No separate site-service package has been configured in this offer version.')]),
      heading(1, sectionLabels[0]),
      normal(isEs ? 'La planificacion de ejecucion, el cierre de KPI y el metodo de aceptacion final se confirmaran en el kick-off de ingenieria, con base en el alcance aprobado, layout, interfaces y preparacion de planta.' : 'Project execution planning, KPI lock and final acceptance method will be confirmed during engineering kick-off, taking the approved scope, layout, interfaces and site readiness into account.'),
      heading(2, sectionLabels[1]),
      ...bullets([
        isEs ? 'Throughput, disponibilidad, logica de interfaces y evidencias SAT se acordaran contra el paquete de ingenieria aprobado.' : 'Throughput, availability, interface handshake logic and SAT evidence will be agreed against the approved engineering package.',
        isEs ? 'Cliente e INGECART cerraran la matriz de responsabilidades, matriz de utilidades y ruta de cierre de punch-list antes de la ejecucion en planta.' : 'Customer and INGECART will freeze the responsibility matrix, utilities matrix and punch-list closure route before site execution.',
      ]).map(bullet),
      heading(1, sectionLabels[2]),
      normal(isEs ? 'La oferta aplica las condiciones comerciales definidas para la empresa activa.' : 'The offer applies the commercial conditions configured for the active company.'),
      buildCommercialConditionsTable(currency, commercialTerms, language),
      heading(2, sectionLabels[3]),
      ...scopeRows.map((row) => bullet(`${row.label}: ${row.scope || (isEs ? 'Alcance configurado' : 'Configured scope')} - ${fmtCurrency(row.proposalPrice, currency, language)}.`)),
      ...(installationRows.length > 0 ? [normal(getAssociatedCostsText(language))] : []),
      heading(2, sectionLabels[4]),
      ...bullets([
        isEs ? 'Obra civil, cimentaciones, permisos, utilidades del cliente e interfaces de terceros quedan excluidos salvo inclusion explicita en el alcance del paquete.' : 'Civil works, foundations, permits, customer-side utilities and third-party interfaces are excluded unless explicitly listed in the package scope.',
        isEs ? 'Cualquier crecimiento de alcance por cambios de layout, retrasos de aprobacion, redefinicion de interfaces o restricciones de planta sera tratado como variacion comercial.' : 'Any scope growth derived from layout changes, delayed approvals, interface redefinition or site restrictions will be reviewed as a commercial variation.',
      ]).map(bullet),
      heading(2, sectionLabels[5]),
      ...bullets([
        getCustomerSupportText(language),
        isEs ? 'El cliente facilitara acceso continuo a planta preparada, decisiones tecnicas en plazo, utilidades, permisos de seguridad y datos de interfaz requeridos para la ejecucion.' : 'Customer to provide continuous access to the ready site, timely technical decisions, utilities, safety permits and interface data required for execution.',
      ]).map(bullet),
      heading(1, sectionLabels[6]),
      ...bullets([
        buildWarrantyTermsText(commercialTerms, language),
        isEs ? 'Exclusiones finales, utilidades, obra civil y responsabilidades del cliente deben adjuntarse a la version comercial aprobada antes de la entrada de pedido.' : 'Final exclusions, utilities, civil works and customer-side responsibilities must be attached to the approved commercial version before order intake.',
        isEs ? 'Prestaciones, capacidades e interfaces quedan sujetas a validacion final de ingenieria sobre el layout y matriz de cargas aprobados por cliente.' : 'Performance, capacities and interfaces are subject to final engineering validation on the approved customer layout and load matrix.',
      ]).map(bullet),
      heading(1, sectionLabels[7]),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
        new TableRow({ children: [cell(isEs ? 'Aceptado por el cliente' : 'Accepted by customer', { fill: LIGHT, bold: true }), cell(isEs ? 'Fecha' : 'Date', { fill: LIGHT, bold: true })] }),
        new TableRow({ children: [cell('\n\n'), cell('\n\n')] }),
      ] }),
    ],
  });

  return new Document({
    creator: 'ASE Offer Builder',
    title: `${offerRef} ${text(input.offer.title)}`.trim(),
    description: 'Commercial proposal generated from ASE using the Sterner / Paige executive proposal structure (' + (input.language === 'es' ? 'Spanish' : 'English') + ' version).',
    styles: {
      paragraphStyles: [
        { id: 'Normal', name: 'Normal', run: { font: 'Arial', size: 19, color: DARK }, paragraph: { spacing: { after: 90, line: 276 } } },
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', bold: true, color: ORANGE, size: 32 }, paragraph: { spacing: { before: 180, after: 70 } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', bold: true, color: DARK, size: 24 }, paragraph: { spacing: { before: 140, after: 40 } } },
      ],
    },
    sections,
  });
};

export const buildOfferWordFileName = (offer: Row, language: OfferWordLanguage = 'en') => {
  const safe = [text(offer.offer_number) || 'OFFER', text(offer.customer_name) || '', text(offer.title) || '']
    .join(' ')
    .replace(/[\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, '_')
    .trim();
  return (safe || 'offer') + '_' + language.toUpperCase() + '.docx';
};

const loadTemplateAsset = async (relativePath: string) => {
  if (typeof fetch !== 'function' || typeof window === 'undefined') {
    throw new Error(`Offer template asset loading is not available for ${relativePath}.`);
  }

  const baseUrl = new URL(import.meta.env.BASE_URL || '/', window.location.origin);
  const response = await fetch(new URL(relativePath, baseUrl));
  if (!response.ok) throw new Error(`Failed to load offer template asset: ${relativePath}`);
  const type = relativePath.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
  return { data: new Uint8Array(await response.arrayBuffer()), type } as const;
};

async function resolveOfferWordTemplateAssets(input: OfferWordExportInput): Promise<OfferWordTemplateAssets> {
  if (!isIngecartTemplate(input)) return {};

  const [headerLogo, coverImage] = await Promise.all([
    loadTemplateAsset(INGECART_TEMPLATE_ASSETS.headerLogo),
    loadTemplateAsset(INGECART_TEMPLATE_ASSETS.coverImage),
  ]);

  return { headerLogo, coverImage };
}

export type OfferWordDownloadResult = {
  fileName: string;
};

export async function downloadOfferWordDocument(input: OfferWordExportInput): Promise<OfferWordDownloadResult> {
  const templateAssets = await resolveOfferWordTemplateAssets(input);
  const blob = await Packer.toBlob(buildOfferWordDocument(input, templateAssets));
  const fileName = buildOfferWordFileName(input.offer, input.language || 'en');
  const url = window.URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  return { fileName };
}
