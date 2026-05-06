# Cost Modules — Best Practices

## Benchmark
- **Oracle Fusion Costing**: Standard costing, actual costing, and lot-based costing.
- **SAP Product Costing**: Multi-level BOM costing with overhead allocation.
- **Epicor**: Real-time job costing with variance analysis.

## KPIs recomendados
| KPI | Descripción | Objetivo |
|-----|-------------|---------|
| Gross margin | (Precio - Coste) / Precio | > 30% |
| Cost variance | Diferencia real vs. estándar | < 5% |
| Quote accuracy | % ofertas donde el coste real ≤ estimado | > 90% |
| Cost per transaction | Coste medio de procesamiento de una oferta | Minimizar |

## Errores comunes
- Rates de costes no actualizadas periódicamente.
- Sin escenarios what-if que permitan optimizar el mix antes de cotizar.
- Falta de trazabilidad de qué módulos de coste aplican a cada oferta.

## Automatizaciones recomendadas
- Alerta cuando el margen estimado de una oferta cae por debajo del umbral mínimo.
- Re-cálculo automático al cambiar el destino o los módulos seleccionados.
- Actualización programada de tarifas base desde fuente de verdad (ERP, contabilidad).
