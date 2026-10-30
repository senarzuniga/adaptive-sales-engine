import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';

const documentsRoot = process.env.USERPROFILE || 'C:/Users/isena';
const contactsRoot = path.join(documentsRoot, 'OneDrive', 'Attachments', 'CONTACTOS');
const sourceFiles = [];

const masterFiles = [
  path.join(contactsRoot, 'Todos los contactos 17-02-2026 9-40-36.xlsx'),
  path.join(contactsRoot, 'CONTACTOS.csv'),
  path.join(contactsRoot, 'CLIENTES', 'Todos los contactos 30-06-2025 14-49-04.xlsx'),
];
const namedSource = path.join(documentsRoot, 'Documents', 'INGECART', 'PROSPECCION', 'Super Corr Expo Orlando 2024_ List.xlsx');
const attendeeSource = path.join(contactsRoot, 'PROSPECCION', 'Copia de Super Corr Expo Orlando 2024_ List.xlsx');
const outputFile = path.resolve(process.argv[2] || path.join(process.cwd(), 'outputs', 'private', 'Mexico_contactos_segmentados_Heriberto.xlsx'));

const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const normalizeKey = (value) => normalize(value).replace(/[^a-z0-9]/g, '');
const isMexico = (value) => ['mexico', 'mx', 'mex'].includes(normalize(value));
const text = (value) => String(value ?? '').trim();

function valueFor(row, aliases) {
  const entries = Object.entries(row);
  const aliasKeys = aliases.map(normalizeKey);
  const match = entries.find(([key]) => aliasKeys.includes(normalizeKey(key)));
  return match ? text(match[1]) : '';
}

function recordsInSheet(file, sheetName) {
  const workbook = XLSX.readFile(file, { cellDates: false });
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return [];
  return XLSX.utils.sheet_to_json(worksheet, { defval: '', blankrows: false });
}

function walkSpreadsheetFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkSpreadsheetFiles(fullPath);
    return /\.(xlsx|xls|csv)$/i.test(entry.name) && path.resolve(fullPath) !== path.resolve(outputFile) ? [fullPath] : [];
  });
}

const contactFileNamePattern = /(contact|contacto|crm|prospect|cliente|customer|account|super.?corr|attend|mailing|database|base.?de.?datos)/i;

function scanContactHeaders(file) {
  const workbook = XLSX.readFile(file, { cellDates: false, bookSheets: false });
  const matches = [];
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;
    const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: false, sheetRows: 8 });
    let best = null;
    for (let headerRow = 0; headerRow < Math.min(matrix.length, 6); headerRow += 1) {
      const headers = matrix[headerRow].map(text);
      const headerKeys = headers.map(normalizeKey);
      const countryHeader = headers.find((header) => /^(country|countryregion|address1countryregion|address1countryregioncompanynameaccount|pais|paisregion|país|paísregión)$/i.test(normalizeKey(header)));
      if (!countryHeader) continue;
      const hasCompany = headerKeys.some((header) => /^(company|companyname|customer|account|organization|organizacion|empresa|cuenta)$/.test(header));
      const hasPerson = headerKeys.some((header) => /^(fullname|contactname|name|nombrecompleto|firstname|lastname|email|emailaddress|email1|telephone1|businessphone|phonenumber|mobilephone)$/.test(header));
      if (!hasCompany && !hasPerson) continue;
      const score = Number(hasCompany) + Number(hasPerson) + Number(headerKeys.some((header) => /^(email|emailaddress|email1)$/.test(header))) + Number(headerKeys.some((header) => /^(fullname|contactname|name|nombrecompleto)$/.test(header)));
      if (!best || score > best.score) best = { headerRow, countryHeader, score };
    }
    if (!best) continue;
    const rows = XLSX.utils.sheet_to_json(worksheet, { range: best.headerRow, defval: '', blankrows: false });
    if (!rows.length) continue;
    const normalized = normalizeKey(path.basename(file));
    const snapshotMatch = path.basename(file).match(/20\d{2}[-_. ]?\d{0,2}[-_. ]?\d{0,2}/);
    matches.push({
      file,
      sheet: sheetName,
      snapshot: snapshotMatch?.[0] || `Modified ${fs.statSync(file).mtime.toISOString().slice(0, 10)}`,
      sourceLabel: `${/crm|prospect|active|contact/i.test(normalized) ? 'CRM/contactos' : 'Directorio empresarial'} — ${path.relative(contactsRoot, file)} — ${sheetName}`,
      countryHeaders: [best.countryHeader],
      rows,
    });
  }
  return matches;
}

function normalizeContact(row, source) {
  const fullName = valueFor(row, ['Full Name', 'Contact Name', 'Nombre completo', 'Name']);
  const firstName = valueFor(row, ['First Name', 'Nombre']);
  const lastName = valueFor(row, ['Last Name', 'Apellidos']);
  const name = fullName || [firstName, lastName].filter(Boolean).join(' ');
  const company = valueFor(row, ['Company Name', 'Company', 'Customer', 'Account', 'Organization', 'Organización', 'Empresa', 'Cuenta', 'Company Name (Account)', 'Company Name (Company)']);
  const email = valueFor(row, ['Email', 'E-mail Address', 'Email Address', 'Dirección de correo electrónico']);
  const phone = valueFor(row, ['Business Phone', 'Phone Number', 'Phone', 'Mobile Phone', 'Teléfono del trabajo', 'Mobile']);
  const title = valueFor(row, ['Job Title', 'Title', 'Puesto', 'Cargo']);
  const department = valueFor(row, ['Department', 'Area', 'Departamento']);
  const city = valueFor(row, ['Address 1: City', 'City', 'Ciudad']);
  const accountCountry = valueFor(row, source.countryHeaders);
  const street = valueFor(row, ['Address 1: Street 1', 'Address', 'Calle del trabajo']);
  const kam = valueFor(row, ['KAM', 'Owner', 'Responsable']);
  const status = valueFor(row, ['Status', 'Status (Company Name) (Account)', 'Estado']);

  return {
    company,
    name,
    title,
    department,
    email,
    phone,
    city,
    street,
    accountCountry,
    kam,
    status,
    source: source.sourceLabel,
    sourceSnapshot: source.snapshot,
    sourceSheet: source.sheet,
    validationStatus: 'Pendiente',
    validationReason: '',
    associatedAccountReview: company,
    validationDate: '',
    validationEvidence: '',
  };
}

function channelSegment(contact) {
  const hasChannel = Boolean(contact.email || contact.phone);
  const hasRole = Boolean(contact.title || contact.department);
  if (!hasChannel) return 'P3 — sin canal directo';
  if (hasRole) return 'P1 — canal y puesto disponibles';
  return 'P2 — canal disponible, puesto pendiente';
}

function roleSegment(contact) {
  const role = normalize(`${contact.title} ${contact.department}`);
  if (!role) return 'Puesto por identificar';
  if (/(ceo|chief|president|presidente|director|vp|vice president|gerente|owner|propietario|general manager)/.test(role)) return 'Dirección / decisión';
  if (/(purchase|procurement|compras|buyer|abastecimiento|supply)/.test(role)) return 'Compras / abastecimiento';
  if (/(engineer|ingenier|technical|tecnic|maintenance|mantenimiento|plant|operations|operacion|produccion|production)/.test(role)) return 'Técnico / operaciones';
  if (/(sales|comercial|marketing|business development|ventas)/.test(role)) return 'Comercial';
  return 'Otro puesto';
}

function sheetData(records) {
  return XLSX.utils.json_to_sheet(records, { skipHeader: false });
}

function addSheet(workbook, name, records) {
  const sheet = sheetData(records);
  if (sheet['!ref']) sheet['!autofilter'] = { ref: sheet['!ref'] };
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

const sourceStats = [];
const uniqueContacts = new Map();
const sourceEmails = new Map();
let spreadsheetsScanned = 0;
let contactSheetsScanned = 0;
let spreadsheetsSkippedByName = 0;
let sourceMexicoRows = 0;
let scanErrors = 0;
for (const file of walkSpreadsheetFiles(contactsRoot)) {
  spreadsheetsScanned += 1;
  if (!contactFileNamePattern.test(path.basename(file))) {
    spreadsheetsSkippedByName += 1;
    continue;
  }
  try {
    const matches = scanContactHeaders(file);
    contactSheetsScanned += matches.length;
    sourceFiles.push(...matches);
  } catch {
    scanErrors += 1;
  }
}

for (const source of sourceFiles) {
  const rows = source.rows || recordsInSheet(source.file, source.sheet);
  let mexicoRows = 0;
  for (const row of rows) {
    const country = valueFor(row, source.countryHeaders);
    if (!isMexico(country)) continue;
    mexicoRows += 1;
    sourceMexicoRows += 1;
    const contact = normalizeContact(row, source);
    if (!contact.company && !contact.name && !contact.email) continue;
    const emailKey = normalize(contact.email);
    const identity = emailKey || `${normalize(contact.company)}|${normalize(contact.name)}`;
    if (!identity || identity === '|') continue;
    const current = uniqueContacts.get(identity);
    if (!current) {
      uniqueContacts.set(identity, contact);
    } else {
      const mergedSources = new Set(`${current.source} | ${current.sourceSheet}`.split(' | '));
      mergedSources.add(contact.source);
      mergedSources.add(contact.sourceSheet);
      for (const key of Object.keys(contact)) {
        if (!current[key] && contact[key]) current[key] = contact[key];
      }
      current.source = [...mergedSources].join(' · ');
    }
    if (emailKey) sourceEmails.set(emailKey, uniqueContacts.get(identity));
  }
  if (mexicoRows > 0) sourceStats.push({
    fuente: source.sourceLabel,
    archivo: path.basename(source.file),
    hoja: source.sheet,
    fechaCorte: source.snapshot,
    filasRevisadas: rows.length,
    filasConPaisMexico: mexicoRows,
    observacion: 'El país corresponde a la cuenta/registro CRM; la ubicación actual del contacto debe confirmarse.',
  });
}

let masterMatches = 0;
for (const file of masterFiles) {
  if (!fs.existsSync(file)) continue;
  let workbook;
  try {
    workbook = XLSX.readFile(file, { cellDates: false });
  } catch {
    continue;
  }
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', blankrows: false });
    for (const row of rows) {
      const email = normalize(valueFor(row, ['Email', 'E-mail Address', 'Email Address', 'Dirección de correo electrónico']));
      if (!email || !sourceEmails.has(email)) continue;
      const contact = sourceEmails.get(email);
      contact.currentCrmStatus = valueFor(row, ['Status', 'Estado']) || contact.currentCrmStatus || '';
      contact.currentCrmCompany = valueFor(row, ['Company Name', 'Company', 'Organization']) || contact.currentCrmCompany || '';
      contact.currentCrmPhone = valueFor(row, ['Business Phone', 'Phone', 'Phone Number']) || contact.currentCrmPhone || '';
      contact.source = `${contact.source} · Coincidencia exacta de email: ${path.basename(file)}`;
      if (!contact.phone && contact.currentCrmPhone) contact.phone = contact.currentCrmPhone;
      masterMatches += 1;
    }
  }
}

const contacts = [...uniqueContacts.values()].map((contact) => ({
  ...contact,
  regionForAction: 'Mexico',
  kamForAction: 'Heriberto',
  accountCountryEvidence: contact.accountCountry,
  segment: roleSegment(contact),
  priority: channelSegment(contact),
  hasEmail: contact.email ? 'Sí' : 'No',
  hasPhone: contact.phone ? 'Sí' : 'No',
  contactLocationStatus: 'Pendiente de confirmar — México es la ubicación de la cuenta en el CRM',
})).sort((a, b) => a.company.localeCompare(b.company) || a.name.localeCompare(b.name));

const priorities = contacts.filter((contact) => contact.priority.startsWith('P1'));
const secondary = contacts.filter((contact) => contact.priority.startsWith('P2'));
const missingChannel = contacts.filter((contact) => contact.priority.startsWith('P3'));
const accountMap = new Map();
for (const contact of contacts) {
  const account = contact.company || 'Cuenta sin identificar';
  const row = accountMap.get(account) || { cuenta: account, contactos: 0, conEmail: 0, conTelefono: 0, sinCanal: 0, puestosIdentificados: 0, fuente: new Set() };
  row.contactos += 1;
  row.conEmail += contact.email ? 1 : 0;
  row.conTelefono += contact.phone ? 1 : 0;
  row.sinCanal += contact.priority.startsWith('P3') ? 1 : 0;
  row.puestosIdentificados += contact.title || contact.department ? 1 : 0;
  for (const label of contact.source.split(' · ')) row.fuente.add(label);
  accountMap.set(account, row);
}
const accounts = [...accountMap.values()].map((row) => ({ ...row, fuente: [...row.fuente].join(' · '), responsableSugerido: 'Heriberto', region: 'Mexico', estadoValidacion: 'Pendiente' }));

const exclusions = [
  { archivo: namedSource, filas: 0, decision: 'Excluido de contactos: el libro indicado contiene series estadísticas de producción de papel, no contactos ni empresas ubicadas en México.' },
  { archivo: path.join(contactsRoot, 'CONTACTOS.csv'), filas: 704, decision: 'Solo se usa para coincidencia exacta por email; carece de campos país/región y no se usa para inferir México.' },
  { archivo: path.join(contactsRoot, 'Todos los contactos 17-02-2026 9-40-36.xlsx'), filas: 4898, decision: 'Solo se cruza por email exacto con cuentas etiquetadas explícitamente México; no contiene país/estado para segmentación independiente.' },
  { archivo: attendeeSource, filas: 9594, decision: 'Excluido de México: el campo Country/Region contiene únicamente Estados Unidos en las filas de la lista; no se asigna por teléfono o nombre.' },
  { archivo: path.join(contactsRoot, 'PROSPECCION', '100 asistentes supercorr 2024 con info.xlsx'), filas: 96, decision: 'Excluido de contactos nominativos: contiene información agregada de empresas y no un directorio con país/contacto verificable.' },
];

const workbook = XLSX.utils.book_new();
const summary = [
  { indicador: 'Ficheros XLS/XLSX/CSV revisados en CONTACTOS', valor: spreadsheetsScanned },
  { indicador: 'Ficheros descartados por no ser directorios CRM/contactos/prospección', valor: spreadsheetsSkippedByName },
  { indicador: 'Hojas estructuradas de contacto/cuenta encontradas', valor: contactSheetsScanned },
  { indicador: 'Filas con país México encontradas antes de deduplicar', valor: sourceMexicoRows },
  { indicador: 'Ficheros no legibles/errores de análisis', valor: scanErrors },
  { indicador: 'Registros únicos con país de cuenta explícito México', valor: contacts.length },
  { indicador: 'P1 — canal directo y puesto/departamento disponible', valor: priorities.length },
  { indicador: 'P2 — canal directo; puesto pendiente', valor: secondary.length },
  { indicador: 'P3 — sin email ni teléfono directo', valor: missingChannel.length },
  { indicador: 'Cuentas mexicanas distintas', valor: accounts.length },
  { indicador: 'Coincidencias exactas de email con exportaciones de contactos 2025/2026/CSV', valor: masterMatches },
  { indicador: 'Responsable de validación', valor: 'Heriberto' },
  { indicador: 'Región de trabajo', valor: 'Mexico' },
  { indicador: 'Criterio geográfico', valor: 'País del registro de cuenta = México; no se infiere ubicación personal.' },
  { indicador: 'Criterio de deduplicación', valor: 'Email normalizado; si falta, empresa + nombre.' },
  { indicador: 'Uso recomendado', valor: 'Verificar actualidad, relación laboral, puesto, cuenta, canal y legitimidad del contacto antes de contactar.' },
];
addSheet(workbook, 'Resumen', summary);
addSheet(workbook, 'Contactos_Mexico', contacts);
addSheet(workbook, 'P1_Canal_y_puesto', priorities);
addSheet(workbook, 'P2_Canal_sin_puesto', secondary);
addSheet(workbook, 'P3_Sin_canal', missingChannel);
addSheet(workbook, 'Cuentas', accounts.sort((a, b) => b.contactos - a.contactos));
addSheet(workbook, 'Fuentes_y_exclusiones', [...sourceStats, ...exclusions]);

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
XLSX.writeFile(workbook, outputFile, { compression: true });
console.log(JSON.stringify({ outputFile, spreadsheetsScanned, spreadsheetsSkippedByName, contactSheetsScanned, scanErrors, sourceMexicoRows, uniqueMexicoContacts: contacts.length, priorities: { p1: priorities.length, p2: secondary.length, p3: missingChannel.length }, mexicoAccounts: accounts.length, exactEmailMatches: masterMatches, sourcesWithMexicoRows: sourceStats.length, sources: sourceStats, exclusions }, null, 2));