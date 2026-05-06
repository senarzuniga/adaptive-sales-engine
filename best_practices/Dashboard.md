# Dashboard — Best Practices

## Benchmark: Cómo lo hacen las herramientas líderes

### Salesforce Einstein Analytics
- Widgets de KPI configurables con comparativa respecto al período anterior.
- Drill-down interactivo: clic en cualquier métrica navega al detalle.
- Alertas predictivas con IA (Einstein) que detecta anomalías automáticamente.
- Personalización por rol: cada usuario ve los datos relevantes para su función.

### Tableau
- Visualizaciones de alta densidad de información con tooltips enriquecidos.
- Story points para narrativas guiadas de datos.
- Conexión a múltiples fuentes en tiempo real.

### Power BI
- Tiles de KPI con semáforos de estado (rojo/amarillo/verde).
- Q&A natural language queries en el propio dashboard.
- Mobile-optimized layouts automáticos.

---

## KPIs recomendados

| KPI | Descripción | Frecuencia |
|-----|-------------|-----------|
| Revenue MTD | Ingresos del mes en curso | Diaria |
| Acciones abiertas | Total de acciones pendientes | Tiempo real |
| Ofertas enviadas | Número de ofertas en período | Semanal |
| Tasa de conversión | % solicitudes → oferta → cierre | Mensual |
| Solicitudes pendientes | Solicitudes sin gestionar | Tiempo real |

---

## Errores comunes

- Mostrar demasiadas métricas sin jerarquía visual.
- No diferenciar el dashboard por departamento o rol.
- Sin indicadores de tendencia (solo valor actual sin contexto histórico).
- Datos que se actualizan solo manualmente.

---

## Automatizaciones recomendadas

- Alerta diaria si hay acciones sin mover en más de 48h.
- Notificación si hay más de 5 solicitudes sin gestionar.
- Resumen ejecutivo automático cada lunes a las 8:00.
