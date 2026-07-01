# Event Capture Integration Report

Cada paso de la orquestación emite eventos al Event Capture Layer (ASEEvent). Eventos generados por la ejecución:

- `AI_INTENT_DETECTED`
- `AI_CONTEXT_BUILT`
- `AI_AGENTS_SELECTED`
- `AI_AGENT_EXECUTION_STARTED`
- `AI_AGENT_EXECUTION_COMPLETED`
- `AI_FUSION_COMPLETED`
- `AI_FACT_CHECK_COMPLETED`
- `AI_QUALITY_VALIDATION`
- `AI_REPLANNING` / `AI_REMERGE_COMPLETED`
- `AI_EXECUTIVE_DECISION`

Estos eventos se almacenan en `modules/ehri` append-only events table y alimentan el ARE para scoring y auditoría.
