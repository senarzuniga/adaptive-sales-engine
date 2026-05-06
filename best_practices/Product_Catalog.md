# Product Catalog — Best Practices

## Benchmark
- **Salesforce CPQ**: Dynamic product bundles, pricing rules, guided selling.
- **SAP Variant Configuration**: Complex product configuration with BOM generation.
- **Zuora**: Subscription-based product catalog with usage-based pricing.

## KPIs recomendados
| KPI | Descripción |
|-----|-------------|
| Catalog completeness | % productos con precio, descripción e imagen completos |
| Price accuracy | % ofertas donde el precio de catálogo es correcto vs. aprobado |
| Bundle attach rate | % ofertas que incluyen productos complementarios |
| Discounting rate | % descuento medio aplicado sobre precio de catálogo |

## Errores comunes
- Catálogo sin versiones → cambios de precio no trazables.
- Sin reglas de descuento máximo por rol comercial.
- Productos obsoletos no marcados ni retirados del catálogo activo.

## Automatizaciones recomendadas
- Alerta cuando el precio de un producto no se actualiza en más de 6 meses.
- Regla de aprobación automática si el descuento supera el umbral por rol.
- Sugerencia de productos complementarios (upsell/cross-sell) al añadir un producto a una oferta.
