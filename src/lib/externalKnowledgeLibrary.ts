export type ExternalKnowledgeArea = 'marketing-content' | 'market-intelligence' | 'product-content' | 'account-content';

export interface ExternalKnowledgeEntry {
  id: string;
  title: string;
  path: string;
  source: string;
  extension: string;
  area: ExternalKnowledgeArea;
  company: string;
  targetAccount: string;
}

export const EXTERNAL_KNOWLEDGE_LIBRARY: ExternalKnowledgeEntry[] = [
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "~$GECART TradeShows Executive Report",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/~$GECART_TradeShows_Executive_Report.docx",
    "source": "IS Backoffice",
    "extension": "docx",
    "area": "market-intelligence",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "00 FIDELITY FRAMEWORK",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/00_FIDELITY_FRAMEWORK.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "00 FINAL README",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/08_FINAL/00_FINAL_README.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "00 INFORME COMPLETO KIT FERIA FESPA 2026",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/fespa-2026-kit-contenidos/00_INFORME_COMPLETO_KIT_FERIA_FESPA_2026.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "00 PLAN ESTUDIO 2H",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/1 ESO/00_PLAN_ESTUDIO_2H.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "marketing-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "00 README",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/07_OUTPUTS/00_README.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "00 README",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/07_SOFTWARE_ARCHITECTURE/00_README.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "00 resumen ejecutivo",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/content-kit/00-resumen-ejecutivo.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "01 ARCHITECTURE REPORT",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/01_ARCHITECTURE_REPORT.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "01 DGM EUROPE DEEP SCRAPING REPORT",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/Equipment Integration/01_DGM_EUROPE_DEEP_SCRAPING_REPORT.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "01 EXPLICACIONES GRAMATICA VOCABULARIO",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/1 ESO/01_EXPLICACIONES_GRAMATICA_VOCABULARIO.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "marketing-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "01 FICHAS PRODUCTO SERVICIO FERIA",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/fespa-2026-kit-contenidos/01_FICHAS_PRODUCTO_SERVICIO_FERIA.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "01 market analysis worldwide",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/machine-trading-boost-plan/01_market_analysis_worldwide.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "01 modules overview",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/07_SOFTWARE_ARCHITECTURE/01_modules_overview.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "01 propuesta valor completa",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/content-kit/01-propuesta-valor-completa.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "01 Warehouse",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/02_SIMULATION_MODEL/01_Warehouse.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "02 BROCHURE FERIA FESPA 2026",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/fespa-2026-kit-contenidos/02_BROCHURE_FERIA_FESPA_2026.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "02 classes",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/07_SOFTWARE_ARCHITECTURE/02_classes.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "02 EJERCICIOS PROGRESIVOS",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/1 ESO/02_EJERCICIOS_PROGRESIVOS.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "marketing-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "02 Exchange",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/02_SIMULATION_MODEL/02_Exchange.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "02 FLEXO SOLUTIONS DEEP SCRAPING REPORT",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/Equipment Integration/02_FLEXO_SOLUTIONS_DEEP_SCRAPING_REPORT.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "02 INGECART VALUE AS DGM INTEGRATOR",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/Equipment Integration/02_INGECART_VALUE_AS_DGM_INTEGRATOR.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "02 kpi templates",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/07_OUTPUTS/02_kpi_templates.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "02 operator map and companies",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/machine-trading-boost-plan/02_operator_map_and_companies.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "02 soluciones catalogo",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/content-kit/02-soluciones-catalogo.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "03 FLEXO SOLUTIONS INGECART TEMPLATE",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/Equipment Integration/03_FLEXO_SOLUTIONS_INGECART_TEMPLATE.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "03 ia y futuro",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/content-kit/03-ia-y-futuro.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "03 icp and prospecting",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/machine-trading-boost-plan/03_icp_and_prospecting.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "03 INGECART CLIENT MESSAGE PLAYBOOK",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/Equipment Integration/03_INGECART_CLIENT_MESSAGE_PLAYBOOK.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "03 interfaces",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/07_SOFTWARE_ARCHITECTURE/03_interfaces.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "03 MINI EXAMEN",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/1 ESO/03_MINI_EXAMEN.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "marketing-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "03 output templates",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/07_OUTPUTS/03_output_templates.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "03 PRESENTACION STAND FESPA 2026",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/fespa-2026-kit-contenidos/03_PRESENTACION_STAND_FESPA_2026.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "03 Transfer",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/02_SIMULATION_MODEL/03_Transfer.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "04 api rest",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/07_SOFTWARE_ARCHITECTURE/04_api_rest.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "04 casos de uso",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/content-kit/04-casos-de-uso.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "04 HOJA RESPUESTAS",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/1 ESO/04_HOJA_RESPUESTAS.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "marketing-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "04 outreach playbooks",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/machine-trading-boost-plan/04_outreach_playbooks.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "04 TARJETAS OBJECIONES Y PUENTES STAND",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/fespa-2026-kit-contenidos/04_TARJETAS_OBJECIONES_Y_PUENTES_STAND.txt",
    "source": "IS Backoffice",
    "extension": "txt",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "05 demand discovery and qualification",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/machine-trading-boost-plan/05_demand_discovery_and_qualification.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "05 GUIA APRENDIZAJE ACELERADO STAND",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/fespa-2026-kit-contenidos/05_GUIA_APRENDIZAJE_ACELERADO_STAND.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "05 preguntas frecuentes",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/content-kit/05-preguntas-frecuentes.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "05 RESUMEN RAPIDO",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/1 ESO/05_RESUMEN_RAPIDO.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "marketing-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "05 risks and assumptions",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/07_OUTPUTS/05_risks_and_assumptions.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "06 events hubs sites",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/machine-trading-boost-plan/06_events_hubs_sites.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "06 mensajes por canal",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/content-kit/06-mensajes-por-canal.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "06 simulation engine",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/07_SOFTWARE_ARCHITECTURE/06_simulation_engine.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "07 animation engine",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/07_SOFTWARE_ARCHITECTURE/07_animation_engine.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "07 scraping cascade plan",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/machine-trading-boost-plan/07_scraping_cascade_plan.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "07 sector corrugado",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/content-kit/07-sector-corrugado.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "08 90 day action plan",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/machine-trading-boost-plan/08_90_day_action_plan.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "08 dashboard",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/07_SOFTWARE_ARCHITECTURE/08_dashboard.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "08 noticias y redes",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/content-kit/08-noticias-y-redes.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "09 ing pro copiloto industrial",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/content-kit/09-ing-pro-copiloto-industrial.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "09 offer pack ingecart inventory",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/machine-trading-boost-plan/09_offer_pack_ingecart_inventory.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "09 reports",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/07_SOFTWARE_ARCHITECTURE/09_reports.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "0b097ad2 3d5e 4dea b2b8 5b1cf67dc403",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/data/competitive_intelligence/jobs/0b097ad2-3d5e-4dea-b2b8-5b1cf67dc403.json",
    "source": "IS Backoffice",
    "extension": "json",
    "area": "market-intelligence",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "0cb5ecca e52b 42cd 97cd 61d7cbd04251",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/data/competitive_intelligence/jobs/0cb5ecca-e52b-42cd-97cd-61d7cbd04251.json",
    "source": "IS Backoffice",
    "extension": "json",
    "area": "market-intelligence",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "0f45027e 755d 4bf4 92d1 202769ecab3d",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/data/competitive_intelligence/jobs/0f45027e-755d-4bf4-92d1-202769ecab3d.json",
    "source": "IS Backoffice",
    "extension": "json",
    "area": "market-intelligence",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "10 configuration ui",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/07_SOFTWARE_ARCHITECTURE/10_configuration_ui.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "10 crawling sources and queries",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/machine-trading-boost-plan/10_crawling_sources_and_queries.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "10 panel publicitario ingetrans es en",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/content-kit/10_panel_publicitario_ingetrans_es_en.txt",
    "source": "IS Backoffice",
    "extension": "txt",
    "area": "product-content",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "105117f1 be5e 4911 b442 25543b67c465",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/data/competitive_intelligence/jobs/105117f1-be5e-4911-b442-25543b67c465.json",
    "source": "IS Backoffice",
    "extension": "json",
    "area": "market-intelligence",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "11 exports",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/07_SOFTWARE_ARCHITECTURE/11_exports.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "11 palletizer contenido comercial completo",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/content-kit/11_palletizer_contenido_comercial_completo.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "12 palletizer sales pitch ejecutivo",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/content-kit/12_palletizer_sales_pitch_ejecutivo.txt",
    "source": "IS Backoffice",
    "extension": "txt",
    "area": "product-content",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "12 PaperGrade",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/02_SIMULATION_MODEL/12_PaperGrade.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "13 palletizer redes web marketing digital",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/content-kit/13_palletizer_redes_web_marketing_digital.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "13 Shift",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/02_SIMULATION_MODEL/13_Shift.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "14 Maintenance",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/02_SIMULATION_MODEL/14_Maintenance.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "14 palletizer guia integracion comercial",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/content-kit/14_palletizer_guia_integracion_comercial.txt",
    "source": "IS Backoffice",
    "extension": "txt",
    "area": "product-content",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "15 Failure",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/02_SIMULATION_MODEL/15_Failure.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "16 SimulationClock",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/02_SIMULATION_MODEL/16_SimulationClock.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "17 EventQueue",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/02_SIMULATION_MODEL/17_EventQueue.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "18 KPIEngine",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/02_SIMULATION_MODEL/18_KPIEngine.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "19 FinancialEngine",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/02_SIMULATION_MODEL/19_FinancialEngine.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "20 AnimationEngine",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/02_SIMULATION_MODEL/20_AnimationEngine.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "21 ScenarioManager",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/02_SIMULATION_MODEL/21_ScenarioManager.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "22 Relationships Diagram",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/02_SIMULATION_MODEL/22_Relationships_Diagram.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "26f2dd34 431f 4cc1 aaa8 418da07a199b",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/data/competitive_intelligence/jobs/26f2dd34-431f-4cc1-aaa8-418da07a199b.json",
    "source": "IS Backoffice",
    "extension": "json",
    "area": "market-intelligence",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "2e19117d 4a22 4990 8853 836bf467704b",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/data/competitive_intelligence/jobs/2e19117d-4a22-4990-8853-836bf467704b.json",
    "source": "IS Backoffice",
    "extension": "json",
    "area": "market-intelligence",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "346da9bb 977a 4f1f 8d09 55e8b285c57c",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/data/competitive_intelligence/jobs/346da9bb-977a-4f1f-8d09-55e8b285c57c.json",
    "source": "IS Backoffice",
    "extension": "json",
    "area": "market-intelligence",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "3c808d63 c319 4004 b580 83bf10925ea9",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/data/competitive_intelligence/jobs/3c808d63-c319-4004-b580-83bf10925ea9.json",
    "source": "IS Backoffice",
    "extension": "json",
    "area": "market-intelligence",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "3fd1a7d0 6118 4737 a3bd 81a7b65d9692",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/data/competitive_intelligence/jobs/3fd1a7d0-6118-4737-a3bd-81a7b65d9692.json",
    "source": "IS Backoffice",
    "extension": "json",
    "area": "market-intelligence",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "645137c1 4027 43a1 b3ae c1c75c814d92",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/data/competitive_intelligence/jobs/645137c1-4027-43a1-b3ae-c1c75c814d92.json",
    "source": "IS Backoffice",
    "extension": "json",
    "area": "market-intelligence",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "662a07b5 cb49 45a4 808f c5a3ddd093f9",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/data/competitive_intelligence/jobs/662a07b5-cb49-45a4-808f-c5a3ddd093f9.json",
    "source": "IS Backoffice",
    "extension": "json",
    "area": "market-intelligence",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "8e5f2d7c cb80 476c a8fb d01e0bb98c8a",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/data/competitive_intelligence/jobs/8e5f2d7c-cb80-476c-a8fb-d01e0bb98c8a.json",
    "source": "IS Backoffice",
    "extension": "json",
    "area": "market-intelligence",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "accessibility",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/.forge/interface/accessibility.md",
    "source": "Ingesite Worktrees",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "algo 01 order generation",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/04_LOGIC_ALGORITHMS/algo_01_order_generation.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "algo 02 reel allocation",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/04_LOGIC_ALGORITHMS/algo_02_reel_allocation.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "algo 03 warehouse selection",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/04_LOGIC_ALGORITHMS/algo_03_warehouse_selection.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "algo 04 track assignment",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/04_LOGIC_ALGORITHMS/algo_04_track_assignment.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "algo 05 transfer scheduling",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/04_LOGIC_ALGORITHMS/algo_05_transfer_scheduling.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "algo 06 forklift dispatching",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/04_LOGIC_ALGORITHMS/algo_06_forklift_dispatching.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "algo 07 priority management",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/04_LOGIC_ALGORITHMS/algo_07_priority_management.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "algo 08 congestion handling",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/04_LOGIC_ALGORITHMS/algo_08_congestion_handling.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "algo 09 starvation prediction",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/04_LOGIC_ALGORITHMS/algo_09_starvation_prediction.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "algo 10 failure generation",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/04_LOGIC_ALGORITHMS/algo_10_failure_generation.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "algo 11 maintenance",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/04_LOGIC_ALGORITHMS/algo_11_maintenance.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "algo 12 recovery",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/04_LOGIC_ALGORITHMS/algo_12_recovery.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "algo 13 oee calculation",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/04_LOGIC_ALGORITHMS/algo_13_oee_calculation.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "algo 14 financial calculation",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/04_LOGIC_ALGORITHMS/algo_14_financial_calculation.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "algo 15 sensitivity analysis",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/04_LOGIC_ALGORITHMS/algo_15_sensitivity_analysis.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "algo 16 simulation end conditions",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/ingetrans-reel-simulator/04_LOGIC_ALGORITHMS/algo_16_simulation_end_conditions.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "amr intralogistics",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io/solutions/amr-intralogistics.html",
    "source": "Ingesite",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "amr intralogistics",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/solutions/amr-intralogistics.html",
    "source": "Ingesite Worktrees",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "amr intralogistics es",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io/solutions/amr-intralogistics-es.html",
    "source": "Ingesite",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "amr intralogistics es",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/solutions/amr-intralogistics-es.html",
    "source": "Ingesite Worktrees",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "amr palletizing interlayer management",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io/public/videos/amr-palletizing-interlayer-management.html",
    "source": "Ingesite",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "amr palletizing interlayer management",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/public/videos/amr-palletizing-interlayer-management.html",
    "source": "Ingesite Worktrees",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "amr palletizing interlayer management v1 editado",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io/public/videos/amr-palletizing-interlayer-management-v1_editado.html",
    "source": "Ingesite",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "amr palletizing interlayer management v1 editado",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/public/videos/amr-palletizing-interlayer-management-v1_editado.html",
    "source": "Ingesite Worktrees",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "ANALISIS CALGARY PHASE 1 AUTOMATION 2026 08 17",
    "path": "C:/Users/isena/Documents/GitHub/AI-FACTORY-v2/INFORMES CALGARY/ANALISIS_CALGARY_PHASE_1_AUTOMATION_2026-08-17.html",
    "source": "AI Factory V2",
    "extension": "html",
    "area": "marketing-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "api contracts",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/.forge/integration/api_contracts.md",
    "source": "Ingesite Worktrees",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "architecture reorganization report",
    "path": "C:/Users/isena/Documents/GitHub/AI-FACTORY-v2/architecture_reorganization_report.txt",
    "source": "AI Factory V2",
    "extension": "txt",
    "area": "marketing-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "assets manifest",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/Research/ingecart/assets/assets_manifest.json",
    "source": "IS Backoffice",
    "extension": "json",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "authorization",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/.forge/integration/authorization.md",
    "source": "Ingesite Worktrees",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "automatic truck loading",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io/solutions/automatic-truck-loading.html",
    "source": "Ingesite",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "automatic truck loading",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/solutions/automatic-truck-loading.html",
    "source": "Ingesite Worktrees",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "automatic truck loading es",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io/solutions/automatic-truck-loading-es.html",
    "source": "Ingesite",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "automatic truck loading es",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/solutions/automatic-truck-loading-es.html",
    "source": "Ingesite Worktrees",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "Automatic Truck Loading Systems",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/assets/images/Automatic Truck Loading Systems.txt",
    "source": "Ingesite Worktrees",
    "extension": "txt",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "b067c949 8756 4cf1 b693 131ab8610f8e",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/data/competitive_intelligence/jobs/b067c949-8756-4cf1-b693-131ab8610f8e.json",
    "source": "IS Backoffice",
    "extension": "json",
    "area": "market-intelligence",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "b7c4eedd 914b 497b 90e1 b180105ef090",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/data/competitive_intelligence/jobs/b7c4eedd-914b-497b-90e1-b180105ef090.json",
    "source": "IS Backoffice",
    "extension": "json",
    "area": "market-intelligence",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "build packaging",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/.forge/operations/build_packaging.md",
    "source": "Ingesite Worktrees",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "business partner report",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/reports/business_partner_report.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "marketing-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "c596f85c 73f9 4ac1 9c0a 68fdc96a2525",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/data/competitive_intelligence/jobs/c596f85c-73f9-4ac1-9c0a-68fdc96a2525.json",
    "source": "IS Backoffice",
    "extension": "json",
    "area": "market-intelligence",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "CALGARY AUTOMATION EXECUTIVE BOARD REPORT 2026 08 17",
    "path": "C:/Users/isena/Documents/GitHub/AI-FACTORY-v2/CALGARY_AUTOMATION_EXECUTIVE_BOARD_REPORT_2026-08-17.md",
    "source": "AI Factory V2",
    "extension": "md",
    "area": "marketing-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "CALGARY PHASE 1 2 3 INGECART REPORT 2026 08 18",
    "path": "C:/Users/isena/Documents/GitHub/AI-FACTORY-v2/CALGARY_PHASE_1_2_3_INGECART_REPORT_2026-08-18.html",
    "source": "AI Factory V2",
    "extension": "html",
    "area": "marketing-content",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "CALGARY PHASE 1 2 3 INGECART REPORT 2026 08 18",
    "path": "C:/Users/isena/Documents/GitHub/AI-FACTORY-v2/CALGARY_PHASE_1_2_3_INGECART_REPORT_2026-08-18.md",
    "source": "AI Factory V2",
    "extension": "md",
    "area": "marketing-content",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "CALGARY PHASE 1 FLOW AND PRODUCTION REPORT 2026 08 17",
    "path": "C:/Users/isena/Documents/GitHub/AI-FACTORY-v2/CALGARY_PHASE_1_FLOW_AND_PRODUCTION_REPORT_2026-08-17.md",
    "source": "AI Factory V2",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "CALGARY PHASE 2 INGECART REPORT 2026 08 18",
    "path": "C:/Users/isena/Documents/GitHub/AI-FACTORY-v2/CALGARY_PHASE_2_INGECART_REPORT_2026-08-18.html",
    "source": "AI Factory V2",
    "extension": "html",
    "area": "marketing-content",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "CALGARY PHASE 2 INGECART REPORT 2026 08 18",
    "path": "C:/Users/isena/Documents/GitHub/AI-FACTORY-v2/CALGARY_PHASE_2_INGECART_REPORT_2026-08-18.md",
    "source": "AI Factory V2",
    "extension": "md",
    "area": "marketing-content",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "CALGARY PHASE 2 INGECART REPORT 2026 08 18",
    "path": "C:/Users/isena/Documents/GitHub/AI-FACTORY-v2/INFORMES CALGARY/CALGARY_PHASE_2_INGECART_REPORT_2026-08-18.html",
    "source": "AI Factory V2",
    "extension": "html",
    "area": "marketing-content",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "CALGARY PHASE 2 PALLETIZING REPORT 2026 08 17",
    "path": "C:/Users/isena/Documents/GitHub/AI-FACTORY-v2/CALGARY_PHASE_2_PALLETIZING_REPORT_2026-08-17.html",
    "source": "AI Factory V2",
    "extension": "html",
    "area": "marketing-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "CALGARY PHASE 2 PALLETIZING REPORT 2026 08 17",
    "path": "C:/Users/isena/Documents/GitHub/AI-FACTORY-v2/CALGARY_PHASE_2_PALLETIZING_REPORT_2026-08-17.md",
    "source": "AI Factory V2",
    "extension": "md",
    "area": "marketing-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "CALGARY PHASE 3 INGECART REPORT 2026 08 18",
    "path": "C:/Users/isena/Documents/GitHub/AI-FACTORY-v2/CALGARY_PHASE_3_INGECART_REPORT_2026-08-18.html",
    "source": "AI Factory V2",
    "extension": "html",
    "area": "marketing-content",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "CALGARY PHASE 3 INGECART REPORT 2026 08 18",
    "path": "C:/Users/isena/Documents/GitHub/AI-FACTORY-v2/CALGARY_PHASE_3_INGECART_REPORT_2026-08-18.md",
    "source": "AI Factory V2",
    "extension": "md",
    "area": "marketing-content",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "CALGARY PHASE 3 INGECART REPORT 2026 08 18",
    "path": "C:/Users/isena/Documents/GitHub/AI-FACTORY-v2/INFORMES CALGARY/CALGARY_PHASE_3_INGECART_REPORT_2026-08-18.html",
    "source": "AI Factory V2",
    "extension": "html",
    "area": "marketing-content",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "CALGARY PHASE 3 INGETRANS AMR REPORT 2026 08 17",
    "path": "C:/Users/isena/Documents/GitHub/AI-FACTORY-v2/CALGARY_PHASE_3_INGETRANS_AMR_REPORT_2026-08-17.html",
    "source": "AI Factory V2",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "CALGARY PHASE 3 INGETRANS AMR REPORT 2026 08 17",
    "path": "C:/Users/isena/Documents/GitHub/AI-FACTORY-v2/CALGARY_PHASE_3_INGETRANS_AMR_REPORT_2026-08-17.md",
    "source": "AI Factory V2",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "CALGARY SUMMARY INGECART REPORT 2026 08 18",
    "path": "C:/Users/isena/Documents/GitHub/AI-FACTORY-v2/CALGARY_SUMMARY_INGECART_REPORT_2026-08-18.html",
    "source": "AI Factory V2",
    "extension": "html",
    "area": "marketing-content",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "CALGARY SUMMARY INGECART REPORT 2026 08 18",
    "path": "C:/Users/isena/Documents/GitHub/AI-FACTORY-v2/INFORMES CALGARY/CALGARY_SUMMARY_INGECART_REPORT_2026-08-18.html",
    "source": "AI Factory V2",
    "extension": "html",
    "area": "marketing-content",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "CALGARY THREE PHASE AUTOMATION MASTER REPORT 2026 08 17",
    "path": "C:/Users/isena/Documents/GitHub/AI-FACTORY-v2/CALGARY_THREE_PHASE_AUTOMATION_MASTER_REPORT_2026-08-17.md",
    "source": "AI Factory V2",
    "extension": "md",
    "area": "marketing-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "canonical mission migration report",
    "path": "C:/Users/isena/Documents/GitHub/AI-FACTORY-v2/data/missions/canonical_mission_migration_report.json",
    "source": "AI Factory V2",
    "extension": "json",
    "area": "marketing-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "COMPREHENSIVE BUSINESS REPORT",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/machine-trading-boost-plan/COMPREHENSIVE_BUSINESS_REPORT.txt",
    "source": "IS Backoffice",
    "extension": "txt",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "config email sender",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/email_sender/config_email_sender.json",
    "source": "IS Backoffice",
    "extension": "json",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "configuration",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/.forge/runtime/configuration.md",
    "source": "Ingesite Worktrees",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "consistency",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/.forge/data/consistency.md",
    "source": "Ingesite Worktrees",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "consolidation report",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io/scripts/consolidation-report.txt",
    "source": "Ingesite",
    "extension": "txt",
    "area": "marketing-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "consolidation report",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/scripts/consolidation-report.txt",
    "source": "Ingesite Worktrees",
    "extension": "txt",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "Content",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/assets/images/Content.txt",
    "source": "Ingesite Worktrees",
    "extension": "txt",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "converter equipment scoring report",
    "path": "C:/Users/isena/Documents/GitHub/AI-FACTORY-v2/docs/converter_equipment_scoring_report.md",
    "source": "AI Factory V2",
    "extension": "md",
    "area": "marketing-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "CORPORATE PRODUCT LANDING",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io/CORPORATE PRODUCT LANDING.txt",
    "source": "Ingesite",
    "extension": "txt",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "CORPORATE PRODUCT LANDING",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/CORPORATE PRODUCT LANDING.txt",
    "source": "Ingesite Worktrees",
    "extension": "txt",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "corrugated events seed 2025 2028",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/reports/corrugated_events_seed_2025_2028.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "marketing-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "corrugated plant automation solutions ingetrans v2",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io/assets/docs/corrugated-plant-automation-solutions-ingetrans-v2.html",
    "source": "Ingesite",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "corrugated plant automation solutions ingetrans v2",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io/docs/corrugated-plant-automation-solutions-ingetrans-v2.html",
    "source": "Ingesite",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "corrugated plant automation solutions ingetrans v2",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io/public/docs/corrugated-plant-automation-solutions-ingetrans-v2.html",
    "source": "Ingesite",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "corrugated plant automation solutions ingetrans v2",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/assets/docs/corrugated-plant-automation-solutions-ingetrans-v2.html",
    "source": "Ingesite Worktrees",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "corrugated plant automation solutions ingetrans v2",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/docs/corrugated-plant-automation-solutions-ingetrans-v2.html",
    "source": "Ingesite Worktrees",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "corrugated plant automation solutions ingetrans v2",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/public/docs/corrugated-plant-automation-solutions-ingetrans-v2.html",
    "source": "Ingesite Worktrees",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "crm import summary",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/machine-trading-boost-plan/runs/2026-05-13/crm/crm_import_summary.json",
    "source": "IS Backoffice",
    "extension": "json",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "CTA content",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/CTA content.txt",
    "source": "Ingesite Worktrees",
    "extension": "txt",
    "area": "product-content",
    "company": "CTA",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "curriculum map",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/1 ESO/curriculum_map.json",
    "source": "IS Backoffice",
    "extension": "json",
    "area": "marketing-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "curriculum map README",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/1 ESO/curriculum_map_README.md",
    "source": "IS Backoffice",
    "extension": "md",
    "area": "marketing-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "daily run stats",
    "path": "C:/Users/isena/Documents/GitHub/IS-BACKOFFICE/informes/ingecart-marketing-kit/ingecart-marketing-kit/machine-trading-boost-plan/runs/2026-05-13/logs/daily_run_stats.json",
    "source": "IS Backoffice",
    "extension": "json",
    "area": "market-intelligence",
    "company": "Ingecart",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "data model",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/.forge/data/data_model.md",
    "source": "Ingesite Worktrees",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "deepseek html DIGITAL TWIN SIMULATION REPORT",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io/assets/docs/deepseek_html_DIGITAL TWIN SIMULATION REPORT.html",
    "source": "Ingesite",
    "extension": "html",
    "area": "marketing-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "deepseek html DIGITAL TWIN SIMULATION REPORT",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io/docs/deepseek_html_DIGITAL TWIN SIMULATION REPORT.html",
    "source": "Ingesite",
    "extension": "html",
    "area": "marketing-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "deepseek html DIGITAL TWIN SIMULATION REPORT",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io/public/docs/deepseek_html_DIGITAL TWIN SIMULATION REPORT.html",
    "source": "Ingesite",
    "extension": "html",
    "area": "marketing-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "deepseek html DIGITAL TWIN SIMULATION REPORT",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/assets/docs/deepseek_html_DIGITAL TWIN SIMULATION REPORT.html",
    "source": "Ingesite Worktrees",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "deepseek html DIGITAL TWIN SIMULATION REPORT",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/docs/deepseek_html_DIGITAL TWIN SIMULATION REPORT.html",
    "source": "Ingesite Worktrees",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "deepseek html DIGITAL TWIN SIMULATION REPORT",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/public/docs/deepseek_html_DIGITAL TWIN SIMULATION REPORT.html",
    "source": "Ingesite Worktrees",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "deployment environments",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/.forge/operations/deployment_environments.md",
    "source": "Ingesite Worktrees",
    "extension": "md",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "DESCRIPCION REPOSITORIO Y WEB",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/DESCRIPCION_REPOSITORIO_Y_WEB.txt",
    "source": "Ingesite Worktrees",
    "extension": "txt",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "Diagnóstico y estado Netlify",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io.worktrees/validate-ingetrans-technical-parameters/Diagnóstico y estado  Netlify.txt",
    "source": "Ingesite Worktrees",
    "extension": "txt",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "DIGITAL TWIN INGETRANS SHORT RUNS CLIENT REPORT 2026 09 08",
    "path": "C:/Users/isena/Documents/GitHub/AI-FACTORY-v2/DIGITAL_TWIN_INGETRANS_SHORT_RUNS_CLIENT_REPORT_2026-09-08.html",
    "source": "AI Factory V2",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "DIGITAL TWIN SIMULATION REPORT SHORT RUNS 2026 08 19",
    "path": "C:/Users/isena/Documents/GitHub/AI-FACTORY-v2/DIGITAL_TWIN_SIMULATION_REPORT_SHORT_RUNS_2026-08-19.txt",
    "source": "AI Factory V2",
    "extension": "txt",
    "area": "marketing-content",
    "company": "General",
    "targetAccount": ""
  },
  {
    "id": "ext-QzovVXNlcnMvaXNlbm",
    "title": "direction audit",
    "path": "C:/Users/isena/Documents/GitHub/ingesite.github.io/solutions/direction-audit.html",
    "source": "Ingesite",
    "extension": "html",
    "area": "product-content",
    "company": "General",
    "targetAccount": ""
  }
];

export const getExternalKnowledgeEntries = (area?: ExternalKnowledgeArea) => area ? EXTERNAL_KNOWLEDGE_LIBRARY.filter((entry) => entry.area === area) : EXTERNAL_KNOWLEDGE_LIBRARY;
