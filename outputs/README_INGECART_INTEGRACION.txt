# MODELO DE INTEGRACIÓN Y ENRIQUECIMIENTO - INGECART

## Instrucciones profesionales para integración total:

1. **Inserción de empresa**
   - Tabla: `companies`
   - Payload ejemplo:
     ```json
     { "company_name": "Ingecart", "industry": "Ingeniería", "created_at": "<auto>" }
     ```
2. **Inserción de ofertas**
   - Tabla: `offers`
   - Asociar `company_id` obtenido tras insertar/buscar la empresa.
   - Payload ejemplo:
     ```json
     { "company_id": "<id>", "offer_number": "...", "customer_name": "...", "status": "...", ... }
     ```
3. **Inserción de clientes**
   - Tabla: `customers`
   - Asociar `company_id`.
   - Payload ejemplo:
     ```json
     { "company_id": "<id>", "customer_name": "...", "country": "...", ... }
     ```
4. **Plan estratégico y competidores**
   - Tabla: `agent_insights` o `company_documents` (según arquitectura)
   - Payload ejemplo:
     ```json
     { "company_id": "<id>", "agent": "intelligence", "insights": ["<plan_estrategico>", "<competidores>"] }
     ```
5. **Activación de agentes**
   - Lanza los agentes de enriquecimiento y cascada desde backend o panel (ver funciones `enrich-company`, `enrich-data`, `process-document`).
   - Esto rellenará huecos, scrapeará y actualizará paneles automáticamente.
6. **Validación**
   - Comprueba que los paneles de ofertas, clientes, inteligencia y acciones muestran los datos y que el flujo leads → oferta → proyecto es trazable y operativo.

---

## Notas:
- El archivo `outputs/inge_cart_integracion_modelo.json` contiene un ejemplo de payloads para integración masiva.
- Puedes adaptar los scripts Python/TS existentes (`supabase_client`, `action_service`, etc.) para automatizar la inserción.
- Tras la inserción, los agentes y paneles se activarán en cascada, enriqueciendo y completando la información.
- Si necesitas scripts de ejemplo para inserción masiva, solicita el formato deseado (Python, TS, CSV, etc.).
