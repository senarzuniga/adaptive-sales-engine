# Ingecart — carga y actualización de paneles (30/10/2026)

## Causas identificadas

1. Gestión Comercial iniciaba con KAM Heriberto y región México: las ofertas de Ingecart/LineText, España, USA, LATAM y otras regiones quedaban ocultas. Un pipeline filtrado vacío no significaba un repositorio vacío.
2. Los lectores de workspace cargaban solo al cambiar de compañía; una escritura de localStorage no notifica a la misma pestaña por sí sola.
3. Varios registros de oportunidades/leads no tienen `id`: se generaban IDs `opp-undefined` / `lead-undefined` y probabilidades de oportunidad mal mapeadas.
4. El snapshot de proyectos se volvía a imponer sobre las ediciones guardadas.
5. El catálogo de acciones modelo (39 acciones) se presentaba como si fuera el plan ejecutable de tareas de la compañía.
6. El paquete de exportación de compañía omitía `offer_packages` y `offer_commercial_terms` aunque el configurador sí los guardaba.

## Correcciones

- Filtros iniciales globales, botón **Quitar filtros** y **Actualizar datos**.
- Diagnóstico visible con cantidades de ofertas, oportunidades, leads, contactos y tareas; hora de última lectura y modo local/remoto.
- Plan de tareas guardadas visible por separado de la biblioteca de acciones modelo.
- Notificación común de escrituras confirmadas, cambios entre pestañas, retorno de foco y visibilidad. Los lectores de workspace se suscriben a la compañía activa; las lecturas asíncronas antiguas de compañía no sustituyen a una selección nueva.
- Ofertas, Gestión Comercial, dashboard, análisis 360, presupuesto, proyectos, posventa, inteligencia, marketing y AI Assistant recargan sus lecturas de workspace. Los paneles dependientes de DataProvider reciben la recarga de datos compartidos.
- En modo Supabase se solicita también reconciliación cada 30 segundos mientras la página está visible. Esto no sustituye a una conexión sana, permisos y un backend operativo.
- Recuperación de datasets **ausentes** de Ingecart desde el paquete distribuido, sin sobrescribir datos ya guardados ni listas vacías expresamente. Un borrado global desactiva esa recuperación.
- Proyectos existentes y sus datos editados prevalecen frente al seed de referencia.
- Identidad de negocio por referencia para no sumar dos veces oferta + oportunidad; IDs estables para leads y oportunidades sin ID de base de datos. Probabilidad cero válida no se sustituye por una puntuación.
- Paquetes y condiciones comerciales incluidos en exportación/importación de compañía.
- OFF-2026-153 permanece como borrador hasta confirmar cliente y campos pendientes; se ve en Ofertas pero no se infla el pipeline activo.

## Datos de referencia auditados

El paquete distribuido de **Ingecart 2018 SL** contiene 59 ofertas, 7 pedidos, 40 oportunidades, 310 leads, 437 contactos, 32 productos y 40 tareas. Son cantidades del snapshot versionado, no una certificación de actualidad de las fuentes externas. El borrador OFF-2026-153 y las tareas creadas por el usuario se agregan en el workspace local.

## Verificación reproducible

- `commercialPanelRefresh.test.tsx`: carga el paquete Ingecart real, verifica pipeline inicial no vacío y comprueba cambios visibles de ofertas en la misma pestaña y en otra pestaña sin remontar el panel.
- `workspaceRefresh.test.ts`: aislamiento por compañía, agrupación de escrituras, foco/cross-tab, conservación de ediciones y vaciados explícitos, rechazo de snapshot de otra empresa.
- `panelsAndAgentsSimulation.test.tsx`: 26 paneles en vacío y con datos Ingecart cargados; comprueba el contexto real de compañía y cantidades.
- La suite incluye las pruebas anteriores de costes, guardar/reabrir, catálogo, generación de documentos y carga de OFF-2026-153.
- Informe de la ejecución: [outputs/ingecart-panel-audit-tests.json](../outputs/ingecart-panel-audit-tests.json).

**Resultado registrado:** 171 pruebas superadas, 0 fallos en la suite completa, incluida la prueba de 26 rutas con datos de Ingecart. Se corrigió el presupuesto temporal de la prueba agregada de rutas vacías (antes 5 s; ahora 30 s para 26 paneles). No se desactivaron aserciones para lograr el resultado.

## Límite operativo

No se garantiza que toda información sea correcta **para siempre** ni que el snapshot sea el último estado de CRM, correo o archivos externos. Lo garantizable por pruebas es el contrato de carga, conservación y recarga de datos guardados bajo las condiciones descritas. Tampoco se ha inspeccionado el almacenamiento de la sesión activa de Chrome: cada host/puerto/perfil mantiene su propio almacenamiento. Desde el 10/11/2026 el lanzador normaliza el origen a `127.0.0.1`; no migra datos de localhost ni de otros puertos.

Una pantalla renderizada no demuestra que su servicio externo esté configurado: correo, IA y Supabase requieren sus conexiones y permisos. Los modos locales y las recomendaciones por reglas no deben presentarse como resultados de un servicio IA remoto.

## Arranque de perfil nuevo — 10/11/2026

- **Objetivo:** permitir acceso al pack público canónico de Ingecart y OFF-2026-S138 en un perfil local nuevo, sin inventar compañías ni reponer compañías eliminadas.
- **Decisión:** reutilizar `importCompanyPack` en DataProvider. Frente a un seed paralelo o una oferta fija en el lanzador, esta opción conserva el contrato de importación, el perfil completo distribuido y el aislamiento por compañía, con menor coste y deuda técnica.
- **Condiciones:** solo modo local (Supabase no configurado) y clave `acs_companies` ausente. Una clave presente, incluso `[]` tras borrar la última compañía, impide el bootstrap. Se vuelve a comprobar después del fetch para respetar escrituras concurrentes.
- **Concurrencia:** una promesa compartida cubre efectos StrictMode y proveedores simultáneos; la importación existente crea la compañía antes de su primer await. Errores HTTP, de red o de identidad del snapshot se notifican y permiten reintentar en un montaje posterior, sin compañía de sustitución.
- **Selección:** si no hay selección activa y hay exactamente una compañía local guardada, se selecciona esa misma compañía; varias compañías sin selección permanecen sin seleccionar. No se crea una compañía adicional. El pack importado remapea los campos `company_id` existentes al ID local generado sin cambiar los IDs de ofertas y partidas.
- **Límites:** no se importa automáticamente a Supabase, no se reescribe el JSON público, no se alteran recuperaciones o configuraciones de ofertas previas. Un clearAll conserva su bandera de exclusión existente.
- **Pruebas:** [startup local real](../src/test/dataProviderStartup.test.tsx), [sin bootstrap remoto](../src/test/dataProviderRemoteStartup.test.tsx) y [S138 en la página real desde almacenamiento vacío](../src/test/ingecartS138Availability.test.tsx). Cubren perfil completo, una sola importación, StrictMode, proveedores concurrentes, listas vacías, otra compañía, selección múltiple, eliminación y escritura durante fetch, errores/reintento y disponibilidad del documento suministrado.
- **Lanzador:** origen IPv4 consistente; la raíz sigue siendo genérica. La ruta `/offer-pricing?offer=OFF-2026-S138` se abre manualmente sobre el origen verificado, no se impone globalmente.
- **Validación final:** 82 pruebas Vitest superadas en 12 archivos (incluida la regresión previa S138, costes, paquetes, Word y guardar/reabrir), 6 pruebas Node del lanzador superadas y build Vite de producción superado con código 0. [Informe JSON](../outputs/fresh-profile-startup-tests.json). Sin errores del editor en los archivos de código modificados. Advertencias de build: base Browserslist antigua y bundle mayor de 500 kB; no se modificaron dependencias ni arquitectura por ese motivo.
- **Smoke operativo:** `launch --no-browser` verificó `http://127.0.0.1:8081/`; la pestaña existente quedó en la ruta S138 y mostró un enlace de descarga Rev3 y un botón para editar OFF-2026-S138. Esta comprobación de navegador usa almacenamiento existente; el arranque realmente vacío está probado por los tests de DataProvider y página real. Se observaron peticiones preexistentes a cost_rates en el host Supabase placeholder, fuera del alcance de este cambio y sin relación con bootstrap remoto.
- **Lección:** la ausencia de la clave de compañías no equivale a una lista vacía. La carga inicial debe respetar ese contrato antes y después de cualquier fetch; el origen del lanzador debe coincidir con el host del servidor y no cambiar silenciosamente entre localhost e IPv4.
- No se ha modificado el JSON público durante esta misión, ni se ha creado commit o push. Se conservaron los cambios previos del árbol de trabajo.

## Integración y validación previa a publicación — 10/11/2026

- Continuación autorizada: commit y push de todos los cambios de ambos repositorios, excluyendo secretos y archivos ignorados. El trabajo ASE quedó inicialmente en `80735b6` y se integraron los seis commits pendientes de `origin/main` mediante merge, sin rebase ni force. No hubo conflictos; las diferencias remotas afectaban únicamente a dos informes de madurez.
- Suite completa posterior al merge: **204 pruebas aprobadas, 0 fallos**. Evidencia: [outputs/post-merge-tests.json](../outputs/post-merge-tests.json). Las **6 pruebas Node del lanzador** también terminaron correctamente.
- Build de producción Vite: código **0**, 3.492 módulos transformados. Persisten las advertencias conocidas de Browserslist antiguo y bundle mayor de 500 kB; no se cambiaron dependencias para ocultarlas.
- Navegador existente en `http://127.0.0.1:8081/offer-pricing?offer=OFF-2026-S138`: una oferta SAICA Rev. 3 por **5.450 EUR**, en estado Draft, con enlace de descarga y acción de edición. El documento público suministrado respondió **HTTP 200**, **82.632 bytes**. No se repitió ninguna migración ni se sobrescribió el workspace durante esta integración.
- El análisis de objetos Git locales pendientes de envío no detectó blobs mayores de 100 MB. No se forzó el historial ni se escribió a Supabase.
- Esta evidencia acredita integración, pruebas y funcionamiento local. El push del código no constituye una certificación de despliegue o sincronización de datos en Lovable; la aceptación de publicación exige comprobar después que HEAD coincida con la referencia remota y que el árbol quede limpio.