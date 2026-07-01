# Agent Registry

Listado de agentes implementados (registro):

- `crm-intel` — CRM Intelligence Agent
- `opportunity-intel` — Opportunity Intelligence Agent
- `pricing-intel` — Pricing Intelligence Agent
- `financial-intel` — Financial Intelligence Agent
- `risk-intel` — Risk Intelligence Agent
- `executive-advisor` — Executive Advisor Agent
- `fact-checker` — Fact Checker Agent
- `quality-assurance` — Quality Assurance Agent

Cada agente expone (en `modules/orchestrator/agents.py`):

- `input_contract()` — descripción de inputs esperados (placeholder en la implementación actual).
- `output_contract()` — descripción de la estructura de salida (placeholder en la implementación actual).
- `execute(context, payload)` — ejecución asincrónica que devuelve un `AgentResult` con: `agent_name`, `output`, `confidence`, `evidence`, `execution_metadata`, `reasoning`.

Cómo extender
--------------
1. Añadir la clase del agente en `modules/orchestrator/agents.py` siguiendo la interfaz `BaseAgent`.
2. Registrar automáticamente mediante `ALL_AGENTS` o ampliar `AgentRegistry` si se requiere registro dinámico.
