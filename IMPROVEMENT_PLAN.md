# IMPROVEMENT PLAN
_Generated: 2026-05-13 05:45 UTC_

## Ranked improvements

| Rank | Module | Improvement | Priority Score | Current Maturity | Effort | Has Template |
|------|--------|-------------|----------------|-----------------|--------|-------------|
| 1 | Budget Command Center | Simulación What-If con sliders + alertas de desviación | 93.5 | 0% | low | ✅ |
| 2 | Key Account Management | Protocolo KAM + Customer Health Score + alertas de riesgo | 90.0 | 0% | low | ✅ |
| 3 | Business Intelligence | Dashboard BI con KPIs, tendencias y exploración de datos | 88.6 | 0% | low | ✅ |
| 4 | Cost Modules | Escenarios What-If en el motor de costes | 74.0 | 0% | medium | ⬜ |
| 5 | Dashboard | Comparativa con período anterior en KPIs del Dashboard | 70.5 | 0% | medium | ⬜ |

---

## Detailed improvement briefs

### #1 — Simulación What-If con sliders + alertas de desviación
- **Module**: Budget Command Center
- **Gap type**: simulation
- **Priority score**: 93.5
- **Current maturity**: 0%
- **Effort**: low
- **Template**: templates/budget_command_center.py.tpl
- **Description**: Añade motor de simulación de escenarios presupuestarios con sliders interactivos, alertas cuando la desviación supera el 10%, gráfico de barras de desviación y exportación de escenarios como CSV.

### #2 — Protocolo KAM + Customer Health Score + alertas de riesgo
- **Module**: Key Account Management
- **Gap type**: protocol
- **Priority score**: 90.0
- **Current maturity**: 0%
- **Effort**: low
- **Template**: templates/key_account_management.py.tpl
- **Description**: Implementa gestión de cuentas clave con protocolo de 6 pasos (Gainsight-style), tabla con Health Score y NPS, alertas automáticas de NPS negativo / sin contacto >30 días / Health Score crítico, y exportación.

### #3 — Dashboard BI con KPIs, tendencias y exploración de datos
- **Module**: Business Intelligence
- **Gap type**: analytics
- **Priority score**: 88.6
- **Current maturity**: 0%
- **Effort**: low
- **Template**: templates/business_intelligence.py.tpl
- **Description**: Crea módulo de Business Intelligence con KPI cards por período, gráfico de tendencias por segmento, top-5 cuentas, distribución de pipeline, configuración de informes programados y exploración de consultas rápidas.

### #4 — Escenarios What-If en el motor de costes
- **Module**: Cost Modules
- **Gap type**: simulation
- **Priority score**: 74.0
- **Current maturity**: 0%
- **Effort**: medium
- **Template**: (requires manual implementation)
- **Description**: Añade simulación de escenarios (optimista/base/pesimista) al motor de costes con slider de ajuste de materiales y alerta de margen mínimo.

### #5 — Comparativa con período anterior en KPIs del Dashboard
- **Module**: Dashboard
- **Gap type**: analytics
- **Priority score**: 70.5
- **Current maturity**: 0%
- **Effort**: medium
- **Template**: (requires manual implementation)
- **Description**: Añade deltas de comparación período anterior a los KPIs del Dashboard, un gráfico de tendencia semanal de acciones y un resumen ejecutivo exportable.

---

## Next action

**Highest priority improvement**: Simulación What-If con sliders + alertas de desviación
Run `python scripts/auto_implement.py --improvement budget_command_center_whatsif` to implement.