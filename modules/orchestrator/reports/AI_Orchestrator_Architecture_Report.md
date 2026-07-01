# AI Orchestrator — Architecture Report

Fecha: 2026-07-01

Resumen
-------
El AI Orchestrator es el coordinador central de la toma de decisiones comerciales en ASE. No contiene lógica de negocio ni cálculos de precios: su responsabilidad es ejecutar el pipeline de inteligencia empresarial y coordinar agentes especializados, la verificación de hechos y la garantía de calidad.

Componentes principales
----------------------
- Intent Analyzer: detecta la intención estructurada a partir de la petición del usuario.
- Context Builder: construye un contexto empresarial unificado a partir de servicios compartidos.
- Agent Registry: catálogo dinámico de agentes disponibles.
- Execution Planner / Parallel Scheduler: ejecuta agentes en paralelo y gestiona dependencias simples.
- Fusion Engine: combina resultados de agentes, computa confianza global y produce un output unificado.
- Fact Checker: valida evidencias, versiones de conocimiento y consistencia del Truth Graph.
- Quality Assessor: calcula métricas de calidad y decide si se debe replanificar.
- Auto Improvement Loop: re-ejecuta agentes necesarios cuando se incumplen umbrales de calidad.
- Event Capture Integration: cada paso emite un `ASEEvent` en el Event Capture Layer para trazabilidad.
- Readiness Integration: cada ejecución alimenta el ARE (ASE Readiness Engine) mediante eventos.

Principios de diseño
--------------------
- Sin lógica de negocio en el orquestador.
- Orquestación declarativa y basada en contratos.
- Trazabilidad total mediante eventos append-only.
- Agentes especializados con contratos IO y puntuación de confianza.
- No llamadas directas a LLMs ni a repositorios fuera del pipeline de conocimiento.

Dónde está el código
---------------------
- `modules/orchestrator/orchestrator.py` — implementación del Orchestrator.
- `modules/orchestrator/agents.py` — agentes especializados (stubs).
- `modules/orchestrator/registry.py` — registro y mapeo de agentes por intención.
