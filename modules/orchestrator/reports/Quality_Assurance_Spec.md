# Quality Assurance Specification

Métricas obligatorias:
- Evidence Score
- Business Accuracy
- Financial Consistency
- Reasoning Quality
- Completeness
- Executive Value
- Confidence

Thresholds por defecto:
- Evidence ≥95
- Business Accuracy ≥90
- Financial Consistency ≥95
- Reasoning ≥90
- Completeness ≥90
- Executive Value ≥90
- Confidence ≥90

QA produce `{ quality_score, meets_thresholds, breakdown }` y dispara replanning si `meets_thresholds` es `false`.
