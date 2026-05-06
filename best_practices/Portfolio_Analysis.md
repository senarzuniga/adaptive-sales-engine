# Portfolio Analysis — Best Practices

## Benchmark: Cómo lo hacen las herramientas líderes

### Alphasense
- Búsqueda semántica en filings, call transcripts y documentos de la empresa.
- Alertas de señales de mercado relevantes al portfolio.
- Análisis de sentimiento de documentos corporativos.

### Bloomberg Terminal
- Matriz BCG en tiempo real con datos de cuota de mercado actualizada.
- Análisis de concentración de cartera con métricas Herfindahl.
- Simulación de escenarios de riesgo con VaR y stress testing.

### FactSet
- Segmentación de cartera por múltiples dimensiones simultáneas.
- Scoring de rentabilidad ajustado por riesgo.
- Reportes regulatorios automatizados.

---

## KPIs recomendados

| KPI | Descripción | Umbral |
|-----|-------------|--------|
| Concentración de cartera | % ingresos del top 5 clientes | > 60% → riesgo |
| Rentabilidad por segmento | Margen por línea de producto | < 15% → revisar |
| Índice BCG | Posición en matriz crecimiento/cuota | Estrella/Vaca/Interrogante/Perro |
| Diversificación sectorial | Distribución por sector cliente | < 3 sectores → diversificar |

---

## Errores comunes

- Análisis de portfolio solo anual en lugar de trimestral.
- Sin clasificación de productos según ciclo de vida (BCG).
- No medir la concentración de riesgo en pocos clientes.
- Análisis estático sin simulaciones de escenarios.

---

## Automatizaciones recomendadas

- Actualización automática de la matriz BCG con datos reales de ventas.
- Alerta si la concentración en el top 3 clientes supera el 50%.
- Informe trimestral de salud del portfolio con recomendaciones.
