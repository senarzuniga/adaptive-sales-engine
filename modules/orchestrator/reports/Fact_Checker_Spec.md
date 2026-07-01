# Fact Checker Specification

El Fact Checker valida que las afirmaciones y referencias estén soportadas por evidencia gobernada:

Validaciones mínimas:
- Evidence presence: cada referencia debe apuntar a un `evidence_id` almacenado en el Evidence Store.
- Knowledge version: verificar que las versiones referenciadas estén `approved`.
- Truth Graph consistency: asegurar que facts no se contradigan con el Truth Graph.

Salida esperada: `{ fact_check_status: approved|rejected, confidence_score, issues: [...] }`.

Importante: el Fact Checker no reescribe evidencia; informa y bloquea respuestas si hay inconsistencias.
