# Informe de Gobernanza del Conocimiento Empresarial

Fecha: 2026-07-01
Autor: Equipo ASE / Copilot (scaffold)

Propósito y alcance
-------------------
Este informe documenta el estado actual y las brechas del pipeline de gobernanza del conocimiento que ASE debe cumplir antes de consumir datos externos. Se centra en los componentes solicitados: Evidence Store, Fact Checker, Confidence Engine, Knowledge Approval Workflow, Knowledge Versioning, Knowledge Steward, Source Reliability Model y sincronización con el Knowledge Graph.

Estado actual (resumen)
-----------------------
- Evidence Store: No implementado. Recomendación: almacenar artefactos inmutables (documentos, snapshots, extractos) con metadatos y firmas.
- Fact Checker: No implementado. Recomendación: motor para contrastar hechos entre fuentes (reglas y ML).
- Confidence Engine: No implementado. Observación: el modelo `BenchmarkValue` incluye un campo `confidence` pero no existe cálculo ni agregación central.
- Knowledge Approval Workflow: Parcial. `storage.approve_version` soporta aprobar versiones EHRI pero falta workflow multi-nivel, roles y auditoría completa.
- Knowledge Versioning: Implementado parcialmente en EHRI para `HourlyRateProfile` (DB sqlite con versionado inmutable).
- Knowledge Steward: No asignado ni automatizado.
- Source Reliability Model: No implementado. Recomendación: definir métrica (confidence, sample_size, last_validation, source_type) y política de caducidad.
- Enterprise Knowledge Graph sync: No implementada. Recomendación: exportador que publique únicamente versiones aprobadas con trazabilidad.

Brechas críticas y riesgos
-------------------------
1. Riesgo de consumo de datos sin validar: sin Evidence Store ni Fact Checker, módulos consumirán información cruda.
2. Falta de aprobación robusta: la aprobación actual no cubre revisiones, rechazos o workflows escalados.
3. Falta de trazabilidad entre recomendaciones AI y la versión de conocimiento usada.

Reglas de gobernanza (confirmadas / to implement)
-----------------------------------------------
- Ninguna tasa puede ser sobrescrita: Implementar inmutabilidad (OK para EHRI profiles).
- Cada modificación crea nueva versión: Parcialmente OK (EHRI).
- Versiones históricas inmutables: Parcialmente OK.
- Proyectos deben referenciar versión usada en la oferta: Pendiente de integración.
- Recomendaciones AI deben referenciar versión activa: Pendiente.

Recomendaciones priorizadas (mínimas)
-------------------------------------
1. Implementar Evidence Store e integrarlo con los pipelines de ingestión.
2. Garantizar que solo versiones aprobadas se sincronizan con Knowledge Graph.
3. Definir y aplicar Source Reliability Model (scoring) y exponerlo en la metadata de cada benchmark.
4. Diseñar workflow de aprobación multi-nivel con audit trail obligatorio y tests de compliance.

Criterios de aceptación de gobernanza
------------------------------------
- Todo conocimiento consumido por módulos productivos debe provenir de una versión aprobada (flag `approved`).
- Cada pieza de conocimiento debe incluir: source, confidence, sample_size, last_validation, geographical_scope.
- El sistema debe permitir auditoría completa: quién, cuándo y por qué se aprobó o rechazó.

Próximo paso propuesto
----------------------
Solicito autorización para diseñar el esquema del Evidence Store y la especificación del Workflow de Aprobación. Esto permitirá ejecutar pruebas de gobierno antes de conectar fuentes externas.

Fin del informe
