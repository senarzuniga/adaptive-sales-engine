# Auto Improvement Loop Specification

Cuando QA no alcanza umbrales:

1. Identificar causa raíz (falta de evidencia, baja confianza, contradicciones).
2. Determinar agentes afectados (aquellos con baja confianza o salidas contradichas).
3. Replanificar: re-ejecutar sólo los agentes afectados.
4. Fusionar resultados y re-evaluar QA.
5. Repetir hasta alcanzar umbrales o hasta `max_retries`.

Reglas:
- Nunca ejecutar agentes no necesarios.
- Registrar cada replanning como evento `AI_REPLANNING`.
