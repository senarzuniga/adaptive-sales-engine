import type { ProductTechnicalDossier } from '@/lib/productCatalog';

const updatedAt = '2026-09-11';

const dossier = (
  dossierId: string,
  valueProposition: string,
  applications: string[],
  technicalSpecifications: ProductTechnicalDossier['technicalSpecifications'],
  performanceKpis: string[],
  roiFramework: string[],
  risksAndLimits: string[],
  acceptanceCriteria: string[],
  sourceReferences: string[],
): ProductTechnicalDossier => ({
  dossierId,
  revision: '1.0',
  updatedAt,
  valueProposition,
  applications,
  technicalSpecifications,
  performanceKpis,
  roiFramework,
  risksAndLimits,
  acceptanceCriteria,
  sourceReferences,
});

const DOSSIERS: Record<string, ProductTechnicalDossier> = {
  ingetrans: dossier(
    'ING-P01',
    'Automated reel supply and return that protects corrugator continuity, removes forklift traffic from the production area and preserves reel identity.',
    ['High-mix corrugators', 'Short production runs', 'Five-roll-stand layouts', 'Forklift traffic reduction'],
    [
      { parameter: 'Transfer capacity', value: 'Up to two reels simultaneously', status: 'verified' },
      { parameter: 'Transfer speed', value: '80 m/min', status: 'verified' },
      { parameter: 'Track speed', value: '59 m/min', status: 'verified' },
      { parameter: 'Pick-up / drop-off', value: '6.0 s mechanical interface per operation', status: 'verified' },
      { parameter: 'Published reel envelope', value: 'Diameter up to 1,500 mm; length up to 1,800 mm; weight below 3,500 kg', status: 'pre-engineering' },
      { parameter: 'Reference direct materials and subcontracting', value: 'EUR 478,150 before internal labor and field costs', status: 'verified' },
    ],
    ['Request-to-delivery P50/P95', 'Starvation minutes per 1,000 operating hours', 'Correct reel deliveries and returns', 'Technical and operational availability', 'Auto-ERP versus manual operating time', 'Damage, interventions and near-misses'],
    ['Recovered production contribution margin', 'Realizable forklift and handling labor', 'Avoided reel damage and selection errors', 'Incremental maintenance, energy, software and spares'],
    ['Final reel matrix governs design; internal sources differ on maximum reel length', 'Digital-twin gains are model results, not audited plant guarantees', 'Published payback below 18 months requires a customer baseline'],
    ['Full reel matrix trials', '100 consecutive cycles at limiting stations', 'Double-reel and partial-return scenarios', 'ERP loss, E-stop and power-loss recovery', 'P95 peak-hour response test'],
    ['INGETRANS FOR OFFERS Techncal DOC.docx', 'Mastercorr PLC export 2026-08-13 to 2026-08-20', 'DIGITAL_TWIN_SIMULATION_REPORT_SHORT_RUNS_2026-08-19.txt'],
  ),
  'carriles motorizados': dossier(
    'ING-P02',
    'Dedicated motorized tracks for repeatable movement of reels or heavy loads between transfer and consumption points.',
    ['INGETRANS feeding tracks', 'Short fixed routes', 'Brownfield transfer links'],
    [
      { parameter: 'Reference configuration', value: '10 units / 16 m', status: 'verified' },
      { parameter: 'Direct cost reference', value: 'EUR 70,513', status: 'verified' },
      { parameter: 'Installation reference', value: '6 days x 2 technicians', status: 'verified' },
      { parameter: 'Load, speed and useful width', value: 'To be defined by load matrix and layout', status: 'pending' },
    ],
    ['Transfers/hour', 'Correct-delivery rate', 'Blockages per 1,000 cycles', 'kWh/load', 'MTBF and MTTR', 'Transfer damage rate'],
    ['Manual movements eliminated', 'Waiting time avoided upstream/downstream', 'Damage avoided', 'Maintenance and future relayout cost'],
    ['Source BOM still uses anonymous Concept 1-7 lines', 'Fixed route reduces flexibility when layout changes'],
    ['100 nominal-load cycles', '20 limit-load cycles', 'Handshake and destination reservation', 'E-stop and jam recovery'],
    ['costes productos.txt', 'INGETRANS Roller public product page'],
  ),
  'amr intralogistics': dossier(
    'ING-P03',
    'Flexible material-flow platform combining AMRs, fleet management, WCS and trident stations for software-defined routing and scalable capacity.',
    ['Dynamic WIP', 'JIT line feeding', 'Reverse logistics', 'Layouts subject to frequent change'],
    [
      { parameter: 'Architecture', value: 'AMR fleet + Fleet Manager/WCS + trident stations', status: 'verified' },
      { parameter: 'Navigation', value: 'Laser natural navigation and dynamic rerouting, subject to selected AMR', status: 'pre-engineering' },
      { parameter: 'Published space gain', value: '35-45% for the documented concept layout', status: 'commercial-claim' },
      { parameter: 'Fleet size', value: 'Simulation and N-1 validation required', status: 'pending' },
    ],
    ['Missions/hour and P50/P95 cycle', 'Fleet availability and N-1 throughput', 'Interventions per 100 missions', 'Docking retries and deadlocks', 'Loaded/empty distance and energy/mission'],
    ['Monetizable WIP space', 'Handling and rehandling avoided', 'Recovered downtime and avoided damage', 'AMRs, chargers, WCS, network, batteries and support'],
    ['AMR is not automatically superior to a fixed system', 'WCS, network, stations and floor remain common-mode risks', 'VDA 5050 does not replace functional safety'],
    ['3D survey and floor assessment', 'Discrete-event peak and N-1 simulation', 'Trident mock-up', 'Pilot stations before full deployment'],
    ['TECHNICAL REPORT AMR INTR.txt', 'KUKA Autonomous Mobile Robotics', 'VDA 5050'],
  ),
  'amr gestion desperdicio area corrugado': dossier(
    'ING-P04',
    'Autonomous exchange, transport, weighing and traceability of corrugator waste cages without interrupting production.',
    ['Corrugator waste collection', 'Automatic full/empty cage exchange', 'Waste weighing by source, order or shift'],
    [
      { parameter: 'Documented scope', value: '1 AMR, 8 cages, 1 weighing station and 4 parking positions', status: 'verified' },
      { parameter: 'Cost-note scope', value: '2 AMRs and eight cage-related lots', status: 'verified' },
      { parameter: 'Provisional direct-cost range', value: 'EUR 190,015.50-319,415.50 pending unit-versus-lot reconciliation', status: 'pending' },
      { parameter: 'Installation reference', value: '25 days x 3 technicians', status: 'verified' },
    ],
    ['kg removed/hour and kg/t produced', 'Request-to-empty-cage P50/P95', 'Overflows and machine blockages', 'Weighing error and trace completeness', 'kWh/t and cleaning hours'],
    ['Realizable handling labor', 'Avoided production stops', 'Waste segregation and traceability value', 'Fleet, cages, weighing, network, battery and fire-protection costs'],
    ['One-versus-two-AMR scope conflict', 'Combustible dust, fire, static and cage stability require specific risk controls', 'Cost BOM is blocked until unit and lot pricing are distinguished'],
    ['100 stable cage exchanges', 'Scale reconciliation against reference weights', 'Peak demand and N-1 test', 'No dropped waste and safe fault recovery'],
    ['TEXTO OFERTAS AMR CORRUGADORA WAIST MANAGEMENT.docx', 'costes productos.txt'],
  ),
  'amr wip management': dossier(
    'ING-P05',
    'Dynamic high-density WIP and JIT converting-line feeding that decouples corrugator output from rigid storage islands.',
    ['120 m WIP corridors', 'Multi-converting-line plants', 'FIFO and curing-aware storage', 'Software-defined allocation'],
    [
      { parameter: 'Reference fleet', value: '4 KUKA AMRs', status: 'verified' },
      { parameter: 'Reference endpoints', value: '20 corrugator cage lots, 10 converting cage lots, 10 tridents and 6 weighing stations', status: 'verified' },
      { parameter: 'Provisional direct-cost band', value: 'EUR 549,431-1,026,431 depending on lot-versus-unit interpretation', status: 'pending' },
      { parameter: 'Installation reference', value: '30 days x 3 technicians', status: 'verified' },
    ],
    ['Mean/peak WIP and age', 'Inventory accuracy and FIFO/curing compliance', 'm2 per useful position', 'Blocked/starved minutes by line', 'Mission P95 and N-1 throughput', 'Rehandling and board damage'],
    ['Avoided expansion or monetizable floor space', 'Recovered production margin', 'Avoided rehandling and damage', 'Fleet, WCS, network, floor preparation and transition costs'],
    ['35-45% space saving is a concept claim, not an independent benchmark', 'Zero bottlenecks and 100% uptime are not defensible guarantees', 'BOM remains blocked pending price-basis reconciliation'],
    ['Survey and floor-quality approval', 'Peak and N-1 simulation', 'Trident mock-up', 'Pilot with explicit scale-up gates'],
    ['INFORME TECNICO AMR WIP.txt', 'costes productos.txt'],
  ),
  sr1400: dossier(
    'ING-P08',
    'Continuous high-reliability scrap logistics focused on availability, cleanliness, maintainability, safety and lifecycle cost.',
    ['Corrugator, casemaker and die-cutter scrap', 'Central baler feeding', 'Brownfield waste-system replacement'],
    [
      { parameter: 'Cost model', value: 'EUR 19,079.30 + EUR 456.17 per meter before site installation and margin', status: 'verified' },
      { parameter: '80 m reference direct cost', value: 'EUR 55,572.90', status: 'verified' },
      { parameter: '80 m installation reference', value: '8 days x 2 technicians', status: 'verified' },
      { parameter: 'Energy claim', value: 'Up to 93% reduction; baseline and methodology not published', status: 'commercial-claim' },
    ],
    ['t/hour and peak capacity', 'kWh/t scrap', 'Accumulation micro-stops', 'Availability, MTBF and MTTR', 'Cleaning hours and dust leakage', 'Lubricant use and cost/t handled'],
    ['Energy at equal tonnage', 'Maintenance, spares and cleaning', 'Avoided downtime and safety exposure', 'Lifecycle TCO and residual value'],
    ['15-20 years is a TCO horizon, not a guaranteed service life', 'Combustible dust and fire controls depend on site conditions'],
    ['Minimum/nominal/peak scrap load', 'Simultaneous infeed test', 'Jam and sectional-stop recovery', 'Dust containment, noise and specific-energy measurement'],
    ['SISTEMA RETAL 1400 DETALLE TECNICO.docx', 'Engineered Waste Logistics System.txt', 'costes productos.txt'],
  ),
  'heavy duty palletizer': dossier(
    'ING-P06',
    'High-duty robotic palletizing, conveyor synchronization and four-side squaring for demanding FFG/RDC end-of-line operation.',
    ['High-throughput converting', 'Mixed bundle profiles', 'Multi-output end of line'],
    [
      { parameter: 'Published simple-bundle cycle', value: '23 +/- 1 cycles/min', status: 'commercial-claim' },
      { parameter: 'Published double-bundle cycle', value: '36 +/- 2 cycles/min', status: 'commercial-claim' },
      { parameter: 'Squaring envelope', value: '650 x 800 x 350 mm to 1,600 x 1,600 x 2,000 mm', status: 'verified' },
      { parameter: 'Reference dual-robot offer', value: 'EUR 895,000 EXW Barcelona', status: 'verified' },
    ],
    ['Good bundles/min by SKU', 'Pallet cycle P50/P95', 'Upstream blocked minutes', 'First-pass pallet acceptance', 'Recipe change time', 'Availability and kWh/pallet'],
    ['Contribution margin from sellable recovered output', 'Realizable labor', 'Avoided pallet damage and rework', 'Robot, tooling, safety and maintenance'],
    ['Cycles/min cannot be converted to boxes/hour without pack and pattern data', 'A published above-400-bundles/min statement conflicts with the robot-cycle data and is excluded'],
    ['SKU and pattern matrix', 'Eight-hour representative run-off', 'Squaring and stability checks', 'Safe access and fault recovery'],
    ['AUTOMATIC ROBOT PALLETIZER SYSTEM.docx', 'Heavy Duty Palletizer public product page'],
  ),
  'plug and play palletizer': dossier(
    'ING-P07',
    'Compact, movable robotic palletizing cell designed for rapid deployment and sharing across lines without major civil works.',
    ['Moderate-throughput FFG lines', 'Multi-line plants', 'Fast brownfield deployment'],
    [
      { parameter: 'Target production', value: 'Approximately 12,000-14,000 boxes/hour, SKU dependent', status: 'commercial-claim' },
      { parameter: 'Post-positioning start-up', value: 'Approximately 3 hours', status: 'commercial-claim' },
      { parameter: 'Utilities', value: '380 V and compressed air; consumption pending', status: 'pre-engineering' },
      { parameter: 'Direct purchase reference', value: 'EUR 137,000 before internal labor and installation', status: 'verified' },
    ],
    ['Good boxes and bundles/hour by family', 'Pallets/hour', 'Format-change and relocation time', 'Upstream blockage', 'Interventions and availability', 'Load stability and consumption'],
    ['Realizable labor', 'Sellable recovered capacity', 'Avoided civil works', 'Value of sharing one asset across lines', 'Safety, utilities, maintenance and relocation costs'],
    ['Three-hour start-up starts after positioning, utilities and safety readiness', 'Published 1.5-2 year ROI requires customer-specific validation'],
    ['Representative SKU run-off', 'Interlayer/base/top-board placement', 'Relocation door-to-door', 'Eight-hour mixed-production test'],
    ['Resumen ejecutivo Plug&Play+Easypack.docx', 'Plug & Play EasyPack + Palletizer public page', 'costes productos.txt'],
  ),
  'easy pack': dossier(
    'ING-P09',
    'Package counting, separation and preparation upstream of palletizing for stable end-of-line flow.',
    ['Folder-gluer output', 'Bundle preparation', 'Integration with Plug & Play Palletizer'],
    [
      { parameter: 'Direct purchase reference', value: 'EUR 195,000 before internal labor and installation', status: 'verified' },
      { parameter: 'Installation reference', value: '7 days x 1 technician', status: 'verified' },
      { parameter: 'Standalone throughput and format envelope', value: 'OEM data required', status: 'pending' },
    ],
    ['Good packages/hour by SKU', 'Count accuracy', 'Bundle geometry and integrity', 'Changeover time', 'Folder-gluer blocked minutes', 'Scrap and interventions'],
    ['Realizable manual tasks', 'Avoided upstream blockage', 'Reduced scrap/rework', 'Installed CAPEX, maintenance and residual staffing'],
    ['The 12,000-14,000 boxes/hour claim belongs to the combined palletizing cell and must not be assigned to Easy Pack alone', 'Independent OEM technical sheet is missing'],
    ['Limiting-format matrix', 'Count and package-quality test', 'Jam recovery', 'Representative production run-off'],
    ['Resumen ejecutivo Plug&Play+Easypack.docx', 'costes productos.txt'],
  ),
  'automatic truck loading system': dossier(
    'ING-P10',
    'Sequenced automatic truck loading that turns dock occupancy into a controlled, repeatable and measurable industrial cycle.',
    ['High dock congestion', 'Standardized outbound loads', 'Carrier waiting-time reduction'],
    [
      { parameter: 'Published manual reference', value: '30-60 min/truck', status: 'commercial-claim' },
      { parameter: 'Published ATLS cycle', value: '3-8 min/truck, scenario dependent', status: 'commercial-claim' },
      { parameter: 'Published peak demonstration', value: 'Approximately 50 s; not a design cycle', status: 'commercial-claim' },
      { parameter: 'Costed standard configuration', value: 'Not yet available', status: 'pending' },
    ],
    ['Dock occupancy P50/P95', 'Trucks/day and on-time departure', 'Carrier waiting time', 'Door utilization', 'Docking failures and damage', 'Person entries into trailer'],
    ['Avoided dock or shift capacity', 'Waiting penalties', 'Realizable labor and damage avoided', 'Trailer interfaces, fleet constraints and maintenance'],
    ['Trailer compatibility, load pattern and dock tolerance are not defined', 'The 50-second demonstration must not be used as the design cycle'],
    ['Vehicle restraint and alignment', 'Full cycle from positioning to release', 'Fault recovery', 'Representative trailer/load matrix'],
    ['Automatic Truck Loading Systems.txt', 'Automatic Truck Loading public product page', 'HSE Loading and unloading guidance'],
  ),
  'transfer car conveyor system intralogistics': dossier(
    'ING-P11',
    'Rail-guided transfer car and fixed conveyor network for repeatable movement of heavy corrugated stacks or pallets between production, WIP and converting.',
    ['Stable heavy-load routes', 'Corrugator-to-WIP transfer', 'High-repeatability fixed layouts'],
    [
      { parameter: 'Reference load', value: '3,000-5,000 kg', status: 'pre-engineering' },
      { parameter: 'Reference lateral speed', value: '1.5-2.5 m/s', status: 'pre-engineering' },
      { parameter: 'Reference positioning', value: '+/- 2-5 mm', status: 'pre-engineering' },
      { parameter: 'Direct-cost interpretation', value: 'EUR 125,000 if seven conveyors are EUR 6,000 each; EUR 89,000 if priced as one lot', status: 'pending' },
    ],
    ['Transfers/hour and origin-destination P50/P95', 'Queue and availability', 'Correct handshakes', 'Load damage and centering', 'MTBF/MTTR', 'Degraded-mode throughput'],
    ['Realizable forklift and operator labor', 'Recovered production and avoided damage', 'Energy, maintenance and single-point-of-failure exposure'],
    ['Seven-conveyor price basis is ambiguous', 'Transfer car concentrates a single point of failure', 'Published performance ranges remain pre-engineering values'],
    ['Destination reservation and alignment', 'Load-centering and scanner tests', 'Network and power-loss recovery', 'Degraded-mode test'],
    ['transfer automatico y conveyor auto.txt', 'costes productos.txt'],
  ),
};

const aliases: Record<string, keyof typeof DOSSIERS> = {
  'ingetran': 'ingetrans',
  'sr 1400': 'sr1400',
  'amr waste management': 'amr gestion desperdicio area corrugado',
  'amr gestion desperdico area corrugado': 'amr gestion desperdicio area corrugado',
  'hd palletizer': 'heavy duty palletizer',
  'truck loading system': 'automatic truck loading system',
  'automatic truck loading': 'automatic truck loading system',
  'transfer car': 'transfer car conveyor system intralogistics',
  'transfer car + conveyor system intralogistics': 'transfer car conveyor system intralogistics',
};

const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function getCanonicalProductDossier(productName: string): ProductTechnicalDossier | undefined {
  const normalized = normalize(productName);
  const key = aliases[normalized] || normalized;
  return DOSSIERS[key];
}

export const CANONICAL_DOSSIER_COUNT = Object.keys(DOSSIERS).length;
