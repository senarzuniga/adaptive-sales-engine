# Pipeline Manager — Best Practices

## Benchmark: Cómo lo hacen las herramientas líderes

### Salesforce Sales Cloud
- Vista Kanban interactiva con drag-and-drop entre etapas.
- Forecast ponderado por probabilidad de cierre automático.
- Alertas de deals estancados más de X días en la misma etapa.
- AI-powered next best action para cada oportunidad.

### HubSpot CRM
- Filtros dinámicos por representante, etapa, tamaño de deal.
- Rotting deals: destacado visual de oportunidades sin actividad.
- Integración bidireccional con email y calendario.

### Pipedrive
- Activities rotting: aviso cuando no hay actividad planificada.
- Smart contact data: enriquecimiento automático de contactos.
- Pipeline revenue forecast con ajuste manual por el comercial.

---

## KPIs recomendados

| KPI | Descripción | Objetivo |
|-----|-------------|---------|
| Pipeline coverage | Ratio pipeline total / objetivo de cuota | > 3x |
| Win rate | % oportunidades ganadas / totales cerradas | > 25% |
| Average sales cycle | Días promedio para cerrar una oportunidad | < 60 días |
| Deal velocity | Revenue / (# deals × días ciclo) | Maximizar |
| Stage conversion rate | % conversión entre etapas consecutivas | Benchmark industria |

---

## Errores comunes

- Pipeline inflado con oportunidades no cualificadas que distorsionan el forecast.
- Sin seguimiento de la velocidad de los deals (solo valor, no tiempo).
- No actualizar la probabilidad de cierre con datos reales.
- Falta de criterios de entrada/salida claros para cada etapa.

---

## Automatizaciones recomendadas

- Alerta si un deal lleva más de 14 días sin actividad en la misma etapa.
- Re-pronóstico automático semanal del pipeline.
- Sugerencia de próxima acción basada en el historial del deal.
