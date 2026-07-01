# Context Builder Specification

El `Context Builder` construye un objeto de contexto que incluye (mínimo):

- `tenant_id` — empresa objetivo
- `user` — id, role, session
- `intent` — objeto de intención
- `session` — datos de sesión (locale, timestamp)
- `knowledge` — referencias a versiones aprobadas (ej.: `ehri.profile_id`, `knowledge_versions`)
- `entities` — identificadores de entidades relevantes (opportunity_id, offer_id, project_id)
- `business_rules` — referencia a reglas aplicables (solo IDs, no ejecución)

Reglas:
- Nunca incluir datos sin la referencia a su versión y fuente.
- No ejecutar agentes si `context` no contiene `tenant_id` y `intent`.
