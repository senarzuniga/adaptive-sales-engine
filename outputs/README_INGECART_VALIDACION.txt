# Guía de validación profesional para integración Ingecart

1. **Ejecuta el script**
   - Ubicación: outputs/inge_cart_integracion_script.py
   - Requisitos: entorno backend con acceso a Supabase y dependencias instaladas.
   - El script valida duplicados, datos mínimos y coherencia antes de insertar.

2. **Verifica en Supabase**
   - Comprueba que la empresa "Ingecart" aparece una sola vez.
   - Revisa que las ofertas y clientes no estén duplicados y tengan los campos clave.
   - Los insights de inteligencia deben estar asociados a la empresa.

3. **Lanza agentes de enriquecimiento**
   - Desde el panel o backend, ejecuta los agentes (`enrich-company`, `enrich-data`, etc.).
   - Valida que los paneles se actualizan y los datos se enriquecen automáticamente.

4. **Valida los paneles y flujos**
   - Panel de ofertas: muestra todas las ofertas nuevas y enriquecidas.
   - Panel de clientes: muestra todos los clientes nuevos y enriquecidos.
   - Panel de inteligencia: muestra el plan estratégico y competidores.
   - Flujo leads → oferta → proyecto: debe ser trazable y operativo.

5. **Corrige incoherencias**
   - Si el script detecta datos inválidos o duplicados, revisa el JSON y corrige antes de reintentar.
   - Si algún panel no se actualiza, revisa los logs de agentes y la configuración de Supabase.

6. **Checklist final**
   - [ ] Empresa única y bien creada
   - [ ] Ofertas y clientes sin duplicados ni errores
   - [ ] Inteligencia y competidores visibles
   - [ ] Paneles y flujos activos y útiles
   - [ ] Sin errores en logs ni datos inconsistentes

---

Con este flujo garantizas una integración profesional, coherente y sin datos erróneos para Ingecart.