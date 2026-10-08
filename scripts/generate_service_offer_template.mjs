// Generates the standard "Ingecart Service Offer Template" and the filled Sterner Global offer.
// Usage: node scripts/generate_service_offer_template.mjs [outputDir]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun, Packer, PageBreak,
  PageNumber, Paragraph, ShadingType, Table, TableCell, TableOfContents, TableRow, TextRun, WidthType,
} from 'docx';

const ORANGE = 'F36B21';
const DARK = '171717';
const GREY = '5C5C5C';
const LIGHT = 'F7F7F7';
const WHITE = 'FFFFFF';
const BORDER = 'D0D0D0';
const FONT = 'Arial';

const root = resolve(import.meta.dirname, '..');
const outputDir = resolve(process.argv[2] || resolve(root, 'outputs', 'service_offers'));
const logo = readFileSync(resolve(root, 'public/offer-assets/ingecart/header-logo.png'));
const cover = readFileSync(resolve(root, 'public/offer-assets/ingecart/cover-reference.jpeg'));

// ---------- Offer data ----------
const TEMPLATE = {
  fileName: 'Ingecart Service Offer Template.docx',
  customer: '[CUSTOMER NAME]',
  site: '[PLANT / SITE, COUNTRY]',
  reference: '[OFF-YYYY-SNNN]',
  date: '[DD Month YYYY]',
  contact: '[CUSTOMER CONTACT NAME / ROLE]',
  kam: '[INGECART ACCOUNT MANAGER]',
  installedBase: ['[EQUIPMENT NAME (ASSET ID / SERIAL NUMBER)]', '[EQUIPMENT NAME (ASSET ID / SERIAL NUMBER)]', '[EQUIPMENT NAME (ASSET ID / SERIAL NUMBER)]'],
};

const STERNER = {
  fileName: 'OFF-2026-S137_Sterner_Global-Mastercorr_Service_Offer_EN.docx',
  customer: 'Sterner Global-Mastercorr',
  site: 'Sterner Global-Mastercorr (USA)',
  reference: 'OFF-2026-S137 Rev.1',
  date: '28 September 2026',
  contact: '[CUSTOMER CONTACT NAME / ROLE]',
  kam: '[INGECART ACCOUNT MANAGER]',
  installedBase: [
    'Ingetrans Rail Transfer (site5_ingetrans_01)',
    '10-Lane Reel Exchange Grid (site5_grid_01)',
    'Warehouse RFID Station (site5_rfid_01)',
  ],
};

// ---------- Text helpers (placeholders in [BRACKETS] are highlighted for editing) ----------
const runs = (value, opts = {}) => String(value).split(/(\[[^\]]+\])/g).filter(Boolean).map((part) => new TextRun({
  text: part,
  font: FONT,
  size: opts.size || 19,
  bold: opts.bold,
  italics: opts.italics,
  color: opts.color || DARK,
  highlight: /^\[[^\]]+\]$/.test(part) ? 'yellow' : undefined,
}));

const p = (value, opts = {}) => new Paragraph({ alignment: opts.align, spacing: { after: opts.after ?? 100, before: opts.before }, children: runs(value, opts) });
const h1 = (value) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 260, after: 100 }, children: runs(value, { size: 30, bold: true, color: ORANGE }) });
const h2 = (value) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 180, after: 70 }, children: runs(value, { size: 23, bold: true }) });
const h3 = (value) => new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 120, after: 50 }, children: runs(value, { size: 20, bold: true, color: GREY }) });
const bullet = (value) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: runs(value) });
const labelled = (label, value) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [...runs(`${label}: `, { bold: true }), ...runs(value)] });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

const border = (color = BORDER) => ({ style: BorderStyle.SINGLE, size: 4, color });
const borders = (color) => ({ top: border(color), bottom: border(color), left: border(color), right: border(color) });
const noBorders = { top: { style: BorderStyle.NONE, size: 0, color: WHITE }, bottom: { style: BorderStyle.NONE, size: 0, color: WHITE }, left: { style: BorderStyle.NONE, size: 0, color: WHITE }, right: { style: BorderStyle.NONE, size: 0, color: WHITE } };

const cell = (value, opts = {}) => new TableCell({
  shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
  borders: borders(opts.fill === DARK || opts.fill === ORANGE ? WHITE : BORDER),
  margins: { top: 60, bottom: 60, left: 100, right: 100 },
  columnSpan: opts.span,
  children: String(value).split('\n').map((line) => new Paragraph({ alignment: opts.align, children: runs(line, { size: 17, bold: opts.bold, color: opts.color }) })),
});

const table = (headers, rows, widths, { totalRow = false } = {}) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  columnWidths: widths,
  rows: [
    new TableRow({ tableHeader: true, children: headers.map((header) => cell(header, { fill: DARK, color: WHITE, bold: true })) }),
    ...rows.map((row, index) => {
      const isTotal = totalRow && index === rows.length - 1;
      return new TableRow({ children: row.map((value, col) => cell(value, {
        fill: isTotal ? ORANGE : index % 2 ? LIGHT : undefined,
        color: isTotal ? WHITE : DARK,
        bold: isTotal || col === 0,
        align: col > 0 && widths.length > 2 && col === row.length - 1 && /EUR|\[PRICE|TOTAL|Included|Quoted/.test(value) ? AlignmentType.RIGHT : undefined,
      })) });
    }),
  ],
});

const keyValueTable = (rows) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  columnWidths: [2800, 6560],
  rows: rows.map(([label, value]) => new TableRow({ children: [cell(label, { fill: DARK, color: WHITE, bold: true }), cell(value, { fill: LIGHT })] })),
});

// ---------- Standard content ----------
const TPM_EQUIPMENT = [
  'Corrugators (single facer, double facer)',
  'Slitter-scorer (rotary and counter-rotary knives)',
  'Automatic stackers',
  'Transport and feeding systems',
  'Correcting groups',
];

const TPM_TEMPLATE = [
  ['Daily check (Operator)', 'Verify pneumatic pressures (6-8 bar)\nCheck hydraulic oil level\nVisual inspection of rollers and belts\nGeneral cleaning of the work area'],
  ['Weekly check (Maintenance)', 'Lubrication of critical points (bearings, guides)\nBelt tension check\nRoller alignment verification\nCompressed air filter cleaning'],
  ['Monthly check (Technician)', 'Calibration of measuring systems\nBlade and counter-blade condition check\nSafety system verification\nMain motor vibration analysis'],
  ['Quarterly check', 'Hydraulic oil change\nComplete electrical system revision\nCritical parts wear verification\nControl software update'],
];

const MACHINE_FAMILIES = [
  ['Corrugating line', 'Single facer, double facer, preheaters, glue machine bridge, humidifier group'],
  ['Converting line', 'Slitter-scorer (rotary shear), rotary counter-rotary, flexographic printer, rotary die-cutter, flatbed die-cutter'],
  ['Handling and finishing', 'Automatic stacker, sheet counter, automatic palletizing system, automatic strapping machine, conveyor belts'],
  ['Auxiliary equipment', 'Correcting groups, paper feeding systems, air compressors, hydraulic power units, glue drying / curing ovens'],
  ['Control systems', 'PLCs and automatic systems, sensors and encoders, frequency drives, operator panels / HMI'],
];

const ADDITIONAL_SERVICES = [
  ['Engineering Services', 'Mechanical, electrical and automation engineering; PLC programming; HMI development; robotics integration; motion control engineering; process optimization; line upgrades and modernization; turnkey project engineering.'],
  ['Software Development', 'In-house software team: PLC software, HMI design, SCADA systems, MES integration, ERP connectivity, database development, production reporting systems, smart factory solutions, AI-based process optimization and digitalization projects.'],
  ['Field Service & On-Site Support', 'Global field service coverage with qualified automation engineers: on-site troubleshooting and repairs, equipment audits and assessments, mechanical and electrical interventions, commissioning, start-up and production ramp-up assistance.'],
  ['Spare Parts & Manufacturing Support', 'Dedicated spare parts engineering, reverse engineering of components, obsolete parts replacement solutions, custom mechanical component manufacturing, spare parts stock management and fast supply of replacement parts.'],
  ['Manufacturing Capabilities', 'Own workshop for fabrication of mechanical assemblies, custom parts, equipment modifications, structural fabrication, prototypes and retrofit components under quality-controlled operations.'],
  ['Modernization & Retrofit', 'Machine upgrades, automation retrofits, control system migrations, safety system upgrades, production capacity improvements, energy efficiency improvements and digital transformation projects.'],
  ['Maintenance & Reliability Programs', 'Equipment health assessments, reliability improvement plans, operational performance reviews, production optimization services and lifecycle management support.'],
  ['Customer Training', 'Operator training, maintenance training, technical workshops, on-site training programs, customized training packages, documentation and knowledge transfer.'],
];

// ---------- Document builder ----------
function buildOffer(d) {
  const header = new Header({ children: [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [6200, 3160],
    rows: [new TableRow({ children: [
      new TableCell({ borders: noBorders, children: [new Paragraph({ children: [new ImageRun({ type: 'png', data: logo, transformation: { width: 90, height: 90 } })] })] }),
      new TableCell({ borders: noBorders, verticalAlign: 'center', children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: runs(d.reference, { size: 15, bold: true, color: GREY }) })] }),
    ] })],
  })] });

  const footer = new Footer({ children: [new Paragraph({
    tabStops: [{ type: 'right', position: 9360 }],
    children: [
      ...runs(`CONFIDENTIAL | ${d.customer} | Annual Service & Lifecycle Support Proposal`, { size: 14, color: GREY }),
      new TextRun({ text: '\tPage ', font: FONT, size: 14, color: GREY }),
      new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 14, color: GREY }),
      new TextRun({ text: ' / ', font: FONT, size: 14, color: GREY }),
      new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 14, color: GREY }),
    ],
  })] });

  const coverPage = [
    new Paragraph({ alignment: AlignmentType.CENTER, shading: { fill: DARK, type: ShadingType.CLEAR, color: 'auto' }, spacing: { after: 0 }, children: runs('ANNUAL SERVICE & LIFECYCLE SUPPORT PROPOSAL', { size: 34, bold: true, color: WHITE }) }),
    new Paragraph({ alignment: AlignmentType.CENTER, shading: { fill: DARK, type: ShadingType.CLEAR, color: 'auto' }, spacing: { after: 0 }, children: runs(d.customer.toUpperCase(), { size: 30, bold: true, color: WHITE }) }),
    new Paragraph({ alignment: AlignmentType.CENTER, shading: { fill: ORANGE, type: ShadingType.CLEAR, color: 'auto' }, spacing: { after: 200 }, children: runs('PREVENTIVE MAINTENANCE  ·  CRITICAL SPARE PARTS  ·  ENGINEERING REPORTS  ·  TPM', { size: 18, bold: true, color: WHITE }) }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'jpg', data: cover, transformation: { width: 600, height: 337 } })] }),
    p('INGECART after-sales service - equipment performance, availability and lifecycle value', { align: AlignmentType.CENTER, size: 15, italics: true, color: GREY, after: 200 }),
    keyValueTable([
      ['Customer', d.customer],
      ['Plant / Site', d.site],
      ['Proposal reference', d.reference],
      ['Date', d.date],
      ['Contract duration', '12 months from service activation'],
      ['Offer validity', '30 calendar days from the proposal date'],
      ['Customer contact', d.contact],
      ['INGECART contact', d.kam],
    ]),
    pageBreak(),
  ];

  const body = [
    h1('CONTENTS'),
    new Paragraph({ children: [new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' })] }),
    pageBreak(),

    h1('1  OFFER LETTER'),
    p(`Dear ${d.customer} Team,`),
    p(`INGECART is pleased to submit proposal ${d.reference} for an annual service and lifecycle support programme covering the INGECART / Ingetrans equipment installed at ${d.site}.`),
    p('The programme combines scheduled preventive maintenance visits, critical spare parts lifecycle management, visit reports and monthly engineering reports based on equipment data and monitoring. Its purpose is to anticipate failures, avoid unplanned downtime and keep every installation performing safely, efficiently and profitably throughout its entire lifecycle.'),
    p('We remain at your disposal to adapt the visit calendar and the scope to your production plan.'),
    p('Kind regards,'),
    p(d.kam, { bold: true }),
    p('INGECART - Customer Support & Lifecycle Services'),

    h1('2  EXECUTIVE SUMMARY'),
    p(`This annual proposal for ${d.customer} delivers a structured maintenance and reliability programme with the following core scope:`),
    labelled('Preventive maintenance', '4 on-site maintenance visits of 3.5 days each, scheduled at the most suitable moment according to planned shutdowns, required spare parts and specific plant needs.'),
    labelled('Critical spare parts management', 'identification of critical components, stock recommendations and control of their useful-life cycles.'),
    labelled('Visit reports', 'a detailed technical report after every maintenance visit.'),
    labelled('Engineering reports', '12 engineering reports per year based on equipment data and monitoring, to anticipate problems and avoid stoppages.'),
    labelled('Official TPM sheets', 'option to perform preventive maintenance with the official INGECART TPM sheets for the covered equipment.'),
    labelled('Mechanical works', 'alignment tasks, parts replacement, line movements and related interventions during the visits.'),
    labelled('Technical support', 'remote connection within 4 hours from notification and priority support for critical production situations.'),

    h1('3  SCOPE OF SERVICES'),
    h2('3.1  Preventive Maintenance Visits'),
    table(['Item', 'Definition'], [
      ['Number of visits', '4 on-site visits per contract year'],
      ['Duration per visit', '3.5 working days'],
      ['Total on-site time', '14 working days per year'],
      ['Scheduling', 'Agreed with the customer at the most suitable moment, considering planned shutdowns, required spare parts, equipment condition and specific production needs'],
      ['Resources', 'Qualified INGECART mechanical / electrical / automation technicians'],
    ], [2800, 6560]),
    h3('Activities performed during each visit'),
    bullet('Inspection of the covered equipment according to the INGECART maintenance checklist.'),
    bullet('Mechanical and electrical checks, adjustments and corrective interventions.'),
    bullet('Alignment tasks (rollers, guides, transfer and conveying elements).'),
    bullet('Replacement of worn or damaged parts (parts invoiced separately unless included in the agreed stock).'),
    bullet('Line movements, repositioning and adjustments of conveying / transfer elements.'),
    bullet('PLC, HMI and motion control diagnostics; software backup and verification.'),
    bullet('Safety system verification.'),
    bullet('Review of open issues with the customer maintenance team and definition of next actions.'),

    h2('3.2  Critical Spare Parts & Lifecycle Management'),
    bullet('Critical components identification program per machine and risk level.'),
    bullet('Recommended on-site stock levels and reorder points.'),
    bullet('Tracking of useful-life cycles and planned replacement of wear components.'),
    bullet('Obsolete parts identification and replacement solutions (including reverse engineering when required).'),
    bullet('Fast supply of replacement parts through INGECART stock and its strategic supplier network.'),

    h2('3.3  Visit Reports'),
    p('After every maintenance visit INGECART issues a technical report including:'),
    bullet('Work performed and parts replaced.'),
    bullet('Equipment condition status and wear findings.'),
    bullet('Prioritised corrective actions and spare parts recommendations.'),
    bullet('Planning proposal for the next visit.'),

    h2('3.4  Engineering Reports (12 per year)'),
    p('INGECART engineers analyse the equipment data and monitoring information on a monthly basis and issue 12 engineering reports per year to anticipate problems and avoid stoppages:'),
    bullet('Analysis of alarms, events and operating trends.'),
    bullet('Early detection of deviations and potential failures.'),
    bullet('Availability and performance indicators of the covered equipment.'),
    bullet('Recommendations for maintenance actions, spare parts and process optimization.'),

    h2('3.5  Official TPM Preventive Maintenance Sheets'),
    p('INGECART makes available to the customer the option of performing preventive maintenance with the official INGECART TPM sheets for the following equipment:'),
    ...TPM_EQUIPMENT.map(bullet),
    h3('Ingetrans specific TPM template'),
    table(['Frequency / responsible', 'Checks'], TPM_TEMPLATE, [2800, 6560]),

    h2('3.6  Mechanical Works Included in the Visits'),
    bullet('Alignment of rollers, guides, rails and conveying elements.'),
    bullet('Replacement of parts identified during inspection.'),
    bullet('Line movements and repositioning of equipment within the agreed visit time.'),
    bullet('Adjustment of tensions, clearances and mechanical settings.'),
    p('Works exceeding the visit time or requiring additional resources will be quoted in advance as additional services.', { italics: true, color: GREY }),

    h1('4  COVERED EQUIPMENT'),
    h2('4.1  Installed base'),
    ...d.installedBase.map(bullet),
    h2('4.2  Equipment families supported'),
    table(['Line / area', 'Equipment'], MACHINE_FAMILIES, [2800, 6560]),

    h1('5  TECHNICAL SUPPORT & REMOTE ASSISTANCE'),
    h2('5.1  Technical Support Services'),
    bullet('Extended technical support coverage across Europe and North America.'),
    bullet('Remote troubleshooting and diagnostics.'),
    bullet('Weekend technical support availability.'),
    bullet('Multi-language technical assistance.'),
    bullet('Direct access to INGECART engineers and specialists.'),
    bullet('Rapid escalation procedures for critical issues.'),
    h2('5.2  Remote Assistance & Connectivity'),
    bullet('Secure remote machine access.'),
    bullet('PLC, HMI and motion control diagnostics.'),
    bullet('Software troubleshooting and recovery.'),
    bullet('Production support, process performance analysis and optimization.'),
    bullet('Online technical consultations and remote commissioning assistance.'),

    h1('6  SERVICE LEVEL COMMITMENT'),
    table(['Service', 'Commitment'], [
      ['Remote connection', 'Within 4 hours from customer notification'],
      ['On-site deployment', 'Qualified personnel within 24 hours whenever international travel conditions allow'],
      ['Critical production situations', 'Priority support and rapid escalation'],
      ['Scheduled maintenance visits', '4 visits x 3.5 days, per the agreed annual calendar'],
      ['Visit report', 'Delivered after each visit'],
      ['Engineering report', 'Monthly (12 per year)'],
    ], [3200, 6160]),

    h1('7  ADDITIONAL SERVICES AVAILABLE'),
    p('The following INGECART services are available on request and are quoted separately:'),
    table(['Service line', 'Scope'], ADDITIONAL_SERVICES, [2800, 6560]),

    h1('8  CUSTOMER RESPONSIBILITIES'),
    bullet('Provide safe access to the equipment during the agreed visit windows, with the line stopped and locked out when required.'),
    bullet('Provide remote access (VPN / secure connection) and equipment data needed for monitoring and engineering reports.'),
    bullet('Provide lifting means, auxiliary equipment and local support staff when required.'),
    bullet('Nominate a technical counterpart for planning, alarm validation and report review.'),
    bullet('Notify incidents through the agreed support channel.'),

    h1('9  EXCLUSIONS'),
    bullet('Spare parts, consumables and wear parts, unless explicitly included in the commercial summary.'),
    bullet('Major repairs, rebuilds, modifications or retrofits outside the described scope.'),
    bullet('Works on third-party equipment not listed in the covered equipment.'),
    bullet('Civil works, utilities and customer-side infrastructure.'),
    bullet('Additional on-site days beyond the 4 x 3.5-day visits, emergency call-outs and overtime, which will be invoiced at the rates in section 10.'),
    bullet('Production losses caused by delays in access, approvals or availability of customer resources.'),

    h1('10  COMMERCIAL SUMMARY'),
    table(['Service', 'Scope', 'Annual price'], [
      ['Preventive maintenance visits', '4 visits x 3.5 days (14 on-site days)', '[PRICE] EUR'],
      ['Critical spare parts & lifecycle management', 'Identification, stock recommendations, lifecycle tracking', '[PRICE] EUR'],
      ['Visit reports', '1 report per visit (4 per year)', 'Included'],
      ['Engineering reports', '12 reports per year based on equipment data and monitoring', '[PRICE] EUR'],
      ['Technical support & remote assistance', 'Remote connection within 4 h, priority escalation', 'Included'],
      ['Official TPM sheets (optional)', 'TPM programme for corrugators, slitter-scorers, stackers, transport and correcting groups', '[PRICE] EUR'],
      ['TOTAL ANNUAL PRICE', '', '[TOTAL PRICE] EUR'],
    ], [3000, 4360, 2000], { totalRow: true }),
    h2('10.1  Rates for additional services'),
    table(['Concept', 'Rate'], [
      ['Additional on-site day (technician)', '[RATE] EUR / day'],
      ['Additional on-site day (engineer)', '[RATE] EUR / day'],
      ['Remote engineering support outside scope', '[RATE] EUR / hour'],
      ['Weekend / public holiday surcharge', '[PERCENTAGE] %'],
      ['Travel, accommodation and daily allowances', '[INCLUDED / INVOICED AT COST]'],
    ], [5360, 4000]),

    h1('11  COMMERCIAL TERMS'),
    keyValueTable([
      ['Currency', 'EUR'],
      ['Duration', '12 months from service activation; renewable by mutual agreement'],
      ['Start-up', 'Less than 30 days from order acceptance'],
      ['Invoicing', '[QUARTERLY IN ADVANCE / PER VISIT]'],
      ['Payment terms', '[30] days from invoice date by bank transfer'],
      ['Price revision', '[ANNUAL REVISION CRITERIA]'],
      ['Validity', '30 calendar days from the proposal date'],
      ['General conditions', 'INGECART general terms of sale in force at the acceptance date'],
    ]),

    h1('12  WHY INGECART'),
    p('INGECART combines the flexibility of an independent engineering company with the responsiveness of a specialized automation partner.'),
    bullet('Over 30 years of experience in the corrugated cardboard sector.'),
    bullet('Deep Ingetrans equipment knowledge from own manufacturing and assembly.'),
    bullet('Complete plans, technical documentation and original spare parts available.'),
    bullet('Own 1,200 m2 workshop with specialized machinery and a permanent stock of critical spare parts.'),
    bullet('Multidisciplinary technical team: mechanical, electrical, automation and in-house software development.'),
    bullet('Fast decision-making and direct access to engineering teams.'),
    bullet('Global technical support and rapid response times.'),
    bullet('Continuous training for customer operators and remote support included.'),
    bullet('Customized solutions and a long-term partnership approach.'),
    h2('12.1  Strategic Supplier Network'),
    p('INGECART works closely with leading industrial technology providers - Siemens, KUKA, SEW-Eurodrive, Festo, SICK, IFM and other globally recognized automation suppliers - giving customers access to worldwide support networks, long-term spare parts availability, proven industrial technologies and reduced operational risk.'),
    h2('12.2  INGECART Commitment'),
    p('"Our mission is not only to deliver equipment, but to ensure that every installation continues to perform safely, efficiently, and profitably throughout its entire lifecycle."', { italics: true, color: GREY }),

    h1('13  OFFER ACCEPTANCE'),
    p('Acceptance of this proposal confirms the scope, visit calendar, service levels and commercial conditions set out herein. Any change of scope will be handled as a written commercial variation.'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [4680, 4680],
      rows: [
        new TableRow({ children: [cell(`For ${d.customer}`, { fill: LIGHT, bold: true }), cell('For INGECART', { fill: LIGHT, bold: true })] }),
        new TableRow({ children: [cell('Name:\nPosition:\nDate:\nSignature:\n\n'), cell('Name:\nPosition:\nDate:\nSignature:\n\n')] }),
      ],
    }),
  ];

  return new Document({
    creator: 'INGECART',
    title: `${d.reference} - Annual Service & Lifecycle Support Proposal - ${d.customer}`,
    features: { updateFields: true },
    styles: {
      default: { document: { run: { font: FONT, size: 19, color: DARK } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, bold: true, color: ORANGE, size: 30 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, bold: true, color: DARK, size: 23 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, bold: true, color: GREY, size: 20 } },
      ],
    },
    sections: [{
      properties: { page: { margin: { top: 1300, bottom: 1100, left: 1200, right: 1200 } } },
      headers: { default: header },
      footers: { default: footer },
      children: [...coverPage, ...body],
    }],
  });
}

mkdirSync(outputDir, { recursive: true });
for (const offer of [TEMPLATE, STERNER]) {
  const target = resolve(outputDir, offer.fileName);
  writeFileSync(target, await Packer.toBuffer(buildOffer(offer)));
  console.log(`Generated ${target}`);
}
