# Agent Contracts

Cada agente debe documentar los siguientes elementos:

- `Input Contract`: campos requeridos en `context` y `payload` (ej.: `tenant_id`, `company_id`, `opportunity_id`, `ehri_profile_id`).
- `Output Contract`: estructura JSON estandarizada (ej.: `{ "decision": { ... }, "metrics": {...} }`).
- `Confidence Score`: valor numérico 0..1 indicando confianza.
- `Evidence References`: lista de objetos `{type, id, source, confidence}`.
- `Execution Metadata`: `{duration, agent_run_id, timestamp}`.
- `Reasoning Summary`: estructurado (bulleted) con referencias a evidencia.

Ejemplo mínimo (JSON schema-like):

```
{
  "input_contract": {"required": ["tenant_id", "opportunity_id"]},
  "output_contract": {"decision": {"type": "string"}, "metrics": {"score": "number"}},
  "confidence": "number",
  "evidence": [{"type":"string","id":"string"}],
  "execution_metadata": {"duration": "number"},
  "reasoning": {"summary": "string"}
}
```
