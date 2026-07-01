# Matriz de Validación de Flujos (Workflow Validation Matrix)

Fecha: 2026-07-01
Autor: Equipo ASE / Copilot (scaffold)

Instrucciones de uso
--------------------
Cada fila representa un flujo obligatorio. Para validar, ejecutar el/los casos E2E asociados, recoger evidencia (logs, snapshots, DB states) y almacenar en el Evidence Store.

Matriz
------
| Flujo | Input / Trigger | Pasos E2E (breve) | Resultado esperado | Evidencia | Estado | Owner |
|---|---|---|---|---|---|---|
| Company Creation | Form/CSV/API | Crear empresa -> validar entidad en DB -> generar company snapshot | Empresa creada con ID y snapshot | -- | Not validated | Product |
| Enterprise Onboarding | Admin trigger | Ejecutar onboarding -> crear roles y datos iniciales | Empresa lista para operar | -- | Not validated | Ops |
| Knowledge Ingestion | Upload/API | Subir paquete -> extraer metadatos -> fact-check -> store evidence | Artefactos versionados y validados | -- | Not validated | KG Team |
| Company Snapshot Generation | Trigger/cron | Generar snapshot con KPIs y versiones activas | Snapshot consistente y firmado | -- | Not validated | Analytics |
| Product Creation | UI/API | Crear producto -> validar reglas de negocio -> publicar | Producto visible y referenciable | -- | Not validated | Product |
| Customer Creation | UI/API | Crear cliente -> validar datos -> asociar contabilidad | Cliente creado | -- | Not validated | Sales |
| Lead Management | CRM events | Crear lead-> seguimiento -> conversión | Lead traza completa | -- | Not validated | Sales Ops |
| Opportunity Management | Sales action | Crear oportunidad -> actualizar estado -> forecast | Oportunidad con history | -- | Not validated | Sales |
| Offer Generation | Template + Knowledge | Generar oferta -> adjuntar versión de tasa -> calcular margen | Oferta con versionado de tasa | -- | Not validated | Commercial |
| Offer Follow-up | Tasks/Notifications | Seguimiento -> registrar interacciones | Historial de contacto | -- | Not validated | Sales |
| Offer Approval | Workflow | Sumbit -> approval chain -> lock version | Oferta aprobada con historial | -- | Not validated | CGO/CFO |
| Offer → Project Transition | Approved offer | Crear proyecto -> vincular oferta/version | Proyecto ligado a oferta/version | -- | Not validated | PMO |
| Project Monitoring | Telemetry | Capturar hitos -> actualizar estado | KPIs y alertas | -- | Not validated | PMO |
| Daily Execution Console | User login | Mostrar acciones diarias -> ejecutar tareas | UX con acciones relevantes | -- | Not validated | UX/Product |
| CGO Panel | Data feeds | Agregar KPIs -> filtros | Dashboard ejecutivo | -- | Not validated | CGO Team |
| CFO Panel | Data feeds | Agregar finanzas -> consolidar | Dashboard financiero | -- | Not validated | Finance |
| Reporting | Scheduler | Ejecutar reports -> distribuir | Reports entregados con versiones | -- | Not validated | Analytics |

Observaciones
-------------
- Actualmente sólo existen artefactos de soporte para el modelo tarifario (EHRI) y una prueba unitaria que valida su comportamiento básico.
- Se requieren casos de prueba E2E, datos de prueba canónicos y un entorno de validación aislado.

Próximo paso
-----------
Definir y priorizar los casos E2E (se recomienda empezar por: Company Creation, Offer Generation, Offer Approval, Offer→Project, Daily Execution). Tras ejecución, completar columna 'Evidencia' con enlaces al Evidence Store.

Fin de la matriz
