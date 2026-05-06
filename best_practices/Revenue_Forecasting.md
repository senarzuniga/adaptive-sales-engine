# Revenue Forecasting — Best Practices

## Benchmark: Cómo lo hacen las herramientas líderes

### Clari
- Revenue Intelligence con actualización en tiempo real desde todas las fuentes.
- Forecast por representante, equipo, región y producto.
- Trend signals basados en actividad de email y calendario.
- "Deal Risk" scoring automático con IA.

### Gong Forecast
- Análisis de conversaciones para detectar señales de cierre o riesgo.
- Forecast bottom-up con reconciliación top-down automática.
- Call analytics para identificar los mejores patrones de cierre.

### Salesforce Forecasting
- Collaborative forecasting con múltiples jerarquías.
- Best case / commit / pipeline separados.
- Einstein AI para forecast predictivo.

---

## KPIs recomendados

| KPI | Descripción | Benchmark |
|-----|-------------|----------|
| Forecast accuracy | % desviación forecast vs. cierre real | < 5% de error |
| Pipeline coverage | Pipeline total / objetivo período | > 3x objetivo |
| Commit accuracy | % deals en "commit" que cierran | > 80% |
| Upside potential | Valor de deals en "best case" | Monitorear |
| CRM hygiene score | % deals con fecha y cantidad actualizadas | > 90% |

---

## Errores comunes

- Forecast basado solo en criterio subjetivo del comercial sin datos.
- No separar pipeline por probabilidad de cierre (commit vs. upside).
- Sin comparativa entre forecast y cierre real histórico.
- Actualización manual del forecast solo semanal en lugar de continua.

---

## Automatizaciones recomendadas

- Actualización automática del forecast cada noche con datos del CRM.
- Alerta si el forecast semanal cae más del 10% respecto a la semana anterior.
- Informe ejecutivo de forecast automático cada lunes.
- Deal risk alert si un deal en "commit" pierde actividad por más de 7 días.
