# Request Pool — Best Practices

## Benchmark
- **Salesforce Service Cloud**: Case management with SLA enforcement and auto-routing.
- **Zendesk**: Ticket prioritization with AI triage and agent workload balancing.
- **HubSpot Service Hub**: Shared inbox, SLA alerts, and CSAT automation.

## KPIs recomendados
| KPI | Descripción | Objetivo |
|-----|-------------|---------|
| First response time | Tiempo hasta primer contacto | < 4h |
| Time to process | Días desde solicitud hasta oferta enviada | < 3 días |
| SLA compliance | % solicitudes procesadas dentro del plazo | > 95% |
| Decline rate | % solicitudes declinadas | < 10% |
| Qualification rate | % solicitudes que avanzan a oferta | > 70% |

## Errores comunes
- Sin priorización automática por urgencia o valor potencial.
- Routing manual que genera cuellos de botella.
- Sin scoring de la solicitud para estimar su valor antes de invertir tiempo.

## Automatizaciones recomendadas
- Score automático de la solicitud (valor potencial + urgencia + fit) al crearse.
- Alerta de SLA si la solicitud lleva más de 24h sin respuesta.
- Routing automático al equipo más adecuado según el tipo de solicitud.
- Notificación automática al solicitante al pasar a cada estado.
