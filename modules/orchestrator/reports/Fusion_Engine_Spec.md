# Fusion Engine Specification

Responsabilidades:

- Agregar salidas de agentes en una única estructura.
- Calcular `global_confidence` (media ponderada por confianza de agentes).
- Detectar contradicciones básicas (por ejemplo: resultados mutuamente exclusivos en outputs clave).
- Priorizar evidencia con mayor `confidence` y mayor `source_reliability`.

Entrada: lista de `AgentResult` (persona/estructura con `agent_name`, `output`, `confidence`, `evidence`).
Salida: `{ outputs, global_confidence, reasons, evidence }`.

Reglas de negocio: la fusión NO debe ejecutar cálculos financieros ni reglas de pricing; solo combinar y priorizar evidencia y señales.
