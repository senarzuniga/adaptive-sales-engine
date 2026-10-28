import { readFileSync, writeFileSync } from "node:fs";

// Root codemod: restores Spanish diacritics (á é í ó ú ñ) stripped from user-facing strings.
// Only exact tokens from the audit are replaced; matcher/alias files get ADDED variants, not removals.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const GLOBAL = [
  // Malformed tokens (missing letter AND accent) — unambiguous corruptions.
  ["Descripcin","Descripción"],["descripcin","descripción"],["Poltica","Política"],["poltica","política"],
  ["Politicas","Políticas"],["politicas","políticas"],["Anlisis","Análisis"],["anlisis","análisis"],
  ["Ttulo","Título"],["ttulo","título"],["Nmero","Número"],["nmero","número"],
  ["Instalacin","Instalación"],["instalacin","instalación"],["INSTALACION","INSTALACIÓN"],
  ["edicin","edición"],["Edicin","Edición"],["Catlogo","Catálogo"],["catlogo","catálogo"],
  ["Aadir","Añadir"],["aadir","añadir"],["aaden","añaden"],["cargarn","cargarán"],
  ["garanta","garantía"],["Garanta","Garantía"],["Garantia","Garantía"],["GARANTIA","GARANTÍA"],
  ["Gestin","Gestión"],["gestin","gestión"],["Financiacin","Financiación"],["financiacin","financiación"],
  ["Logstica","Logística"],["logstica","logística"],["Negociacin","Negociación"],
  ["Validacin","Validación"],["Desviacin","Desviación"],["Categoras","Categorías"],["categora","categoría"],
  ["Mnimo","Mínimo"],["Hipotesis","Hipótesis"],["hipotesis","hipótesis"],["viticos","viáticos"],
  ["segn","según"],["senales","señales"],["Econmico","Económico"],["Ambito","Ámbito"],
  ["lneas","líneas"],["Lnea","Línea"],["lnea","línea"],["Linea","Línea"],["linea","línea"],
  // Complete-but-unaccented Spanish words in display strings.
  ["Descripcion","Descripción"],["descripcion","descripción"],["direccion","dirección"],["Direccion","Dirección"],
  ["Gestion","Gestión"],["gestion","gestión"],["GESTION","GESTIÓN"],
  ["instalacion","instalación"],["Instalacion","Instalación"],
  ["Ingeniera","Ingeniería"],["ingeniera","ingeniería"],["Ingenieria","Ingeniería"],["ingenieria","ingeniería"],
  ["negociacion","negociación"],["validacion","validación"],["Validacion","Validación"],
  ["configuracion","configuración"],["Configuracion","Configuración"],["ejecucion","ejecución"],["Ejecucion","Ejecución"],
  ["formacion","formación"],["Formacion","Formación"],["aceptacion","aceptación"],["elevacion","elevación"],
  ["planificacion","planificación"],["preparacion","preparación"],["integracion","integración"],
  ["solucion","solución"],["emision","emisión"],["adjudicacion","adjudicación"],["expedicion","expedición"],
  ["exportacion","exportación"],["finalizacion","finalización"],["notificacion","notificación"],
  ["supervision","supervisión"],["Supervision","Supervisión"],["monitorizacion","monitorización"],
  ["subcontratacion","subcontratación"],["calculo","cálculo"],["Calculo","Cálculo"],
  ["metodo","método"],["logica","lógica"],["tecnica","técnica"],["tecnicas","técnicas"],["tecnico","técnico"],["tecnicos","técnicos"],
  ["mecanico","mecánico"],["mecanica","mecánica"],["electrico","eléctrico"],["electrica","eléctrica"],
  ["Fabricacion","Fabricación"],["Facturacion","Facturación"],["Correccion","Corrección"],["Organizacion","Organización"],
  ["Almacen","Almacén"],["exito","éxito"],["periodo","período"],["Periodo","Período"],
  ["maxima","máxima"],["minimo","mínimo"],["todavia","todavía"],["criticas","críticas"],
  ["dias","días"],["Das","Días"],["segun","según"],["rapida","rápida"],["busqueda","búsqueda"],
  ["respondi","respondió"],["ingles","inglés"],["accion","acción"],["Accion","Acción"],
  ["debera","deberá"],["cerrara","cerrará"],["cerraran","cerrarán"],["quedaran","quedarán"],
  ["facilitara","facilitará"],["acordaran","acordarán"],["confirmaran","confirmarán"],
  ["gruas","grúas"],["estan","están"],["titulo","título"],["numero","número"],
  // Phrase-level fixes.
  ["se guard en","se guardó en"],["asi como","así como"],["mas tarde","más tarde"],
  ["Por qu INGECART","Por qué INGECART"],["recepcion del anticipo","recepción del anticipo"],
  ["cierre de diseno","cierre de diseño"],["Pas","País"],
  // Mojibake residue.
  ["seales","señales"],["a?adido","añadido"],["Duplicaci?n","Duplicación"],["Reducci?n","Reducción"],
  ["descripci?n","descripción"],["rec?rgalos","recárgalos"],["MESA 90?","MESA 90°"],
];

const FILE_MAP = {
  "src/pages/DashboardPage.tsx": [["ano","año"]],
  "src/pages/CommercialActionsRepositoryPage.tsx": [["Version {","Versión {"]],
  "src/lib/offerWordExport.ts": [["esta version","esta versión"],["la version comercial","la versión comercial"]],
  "src/lib/ingecartProjectSeed.ts": [["90 Âª","90 ª"]],
  "src/pages/AIAssistantPage.tsx": [["bilingue","bilingüe"],["revision y uso","revisión y uso"],["}  {","} · {"],["} {entry.","} · {entry."]],
  "src/pages/MarketingContentPage.tsx": [["} ? {","} · {"]],
  "src/test/offerCostExport.test.ts": [["Direccion ingenieria electrica","Dirección de ingeniería eléctrica"]],
  "scripts/build_ingecart_pack.py": [["ESPA?A","ESPAÑA"]],
};

const files = [
  "src/pages/OfferPricingPage.tsx","src/lib/offerWordExport.ts","src/lib/offerCostExport.ts",
  "src/lib/offerPackages.ts","src/components/offers/OfferPackagePlanner.tsx","src/pages/DashboardPage.tsx",
  "src/pages/AfterSalesEnginePage.tsx","src/pages/AIAssistantPage.tsx","src/components/AppSidebar.tsx",
  "src/pages/CommercialActionsRepositoryPage.tsx","src/lib/productKnowledge.ts","src/lib/projectDecisionLog.ts",
  "src/lib/ingecartProjectSeed.ts","src/pages/MarketingContentPage.tsx",
  "src/test/offerCostExport.test.ts","src/test/productKnowledge.test.ts","scripts/build_ingecart_pack.py",
];

let totalReplacements = 0;
const report = [];
for (const file of files) {
  let content;
  try { content = readFileSync(file, "utf8"); } catch { report.push(file + "\tSKIP (not found)"); continue; }
  let count = 0;
  const apply = (from, to) => {
    const re = new RegExp("(?<![A-Za-z0-9_])" + esc(from) + "(?![A-Za-z0-9_])", "g");
    const n = (content.match(re) || []).length;
    if (n > 0) { content = content.replace(re, to); count += n; }
  };
  for (const [from, to] of GLOBAL) apply(from, to);
  for (const [from, to] of (FILE_MAP[file] || [])) apply(from, to);
  if (count > 0) writeFileSync(file, content, "utf8");
  totalReplacements += count;
  report.push(file + "\t" + count);
}
console.log(report.join("\n"));
console.log("TOTAL_REPLACEMENTS=" + totalReplacements);
