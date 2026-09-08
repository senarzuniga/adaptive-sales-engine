# Adaptive Sales Engine — Resumen Ejecutivo para Desarrolladores

## Visión General
Adaptive Sales Engine es una plataforma modular de gestión empresarial (CRM/ERP) con agentes de IA integrados, diseñada para triplicar la productividad de equipos comerciales, financieros y de soporte. Su arquitectura prioriza la trazabilidad, la automatización, la experiencia de usuario y la extensibilidad, permitiendo a empresas de cualquier tamaño digitalizar y optimizar todos sus procesos clave.

## Características Principales
- **CRM, ERP, Finanzas, Soporte y Backoffice**: Módulos independientes y conectados, cada uno con paneles de control, KPIs, ranking, alertas, recomendaciones y resúmenes ejecutivos.
- **Agentes de IA**: Automatización de análisis, scoring, recomendaciones, generación de acciones y feedback en bucle.
- **Onboarding y Ayuda Contextual**: Paneles de bienvenida, tips de productividad y ayuda contextual en cada módulo.
- **Trazabilidad y Accesos Rápidos**: Navegación lógica, accesos directos y paneles de actividad reciente en todos los módulos.
- **Integración con Supabase**: Persistencia de datos en la nube o modo local para pruebas/demo.
- **Automatización de Productividad**: Acciones masivas, plantillas, generación de informes y paneles de orquestación.
- **Cumplimiento con la API Streamlit**: Uso de `width='stretch'` en todos los componentes visuales para máxima compatibilidad y experiencia responsive.

## Estructura del Proyecto
- `/domain/` — Modelos de negocio, lógica de dominio y agentes de IA.
- `/ui/pages/` — Páginas Streamlit para cada módulo y panel.
- `/infrastructure/` — Integraciones externas (Supabase, email, etc).
- `/public/` — Recursos estáticos (iconos, imágenes).
- `/scripts/` — Utilidades y automatizaciones.
- `/outputs/` — Resultados de agentes y logs.
- `streamlit_app.py` — Router principal, navegación, sesión y autenticación.
- `config.py` — Flags de entorno y configuración global.
- `requirements.txt` — Dependencias principales (Python 3.14+, Streamlit, pandas, plotly, etc).

## Flujo de Trabajo y Mejores Prácticas
1. **Modularidad**: Cada módulo es autocontenible y puede evolucionar de forma independiente.
2. **Extensibilidad**: Añade nuevos agentes, paneles o integraciones siguiendo el patrón de carpetas y modelos Pydantic.
3. **Automatización**: Prioriza la automatización de tareas repetitivas y la generación de valor mediante IA.
4. **UX y Accesibilidad**: Todos los paneles incluyen onboarding, ayuda y accesos rápidos. El diseño es mobile-first y accesible.
5. **Validación Continua**: Cada cambio debe ser validado con pruebas funcionales y benchmarks de productividad.
6. **Documentación**: Mantén este README y los docstrings actualizados. Usa comentarios claros y orientados a negocio.

## Primeros Pasos para Desarrolladores
1. **Clona el repositorio y crea un entorno virtual**:
   ```bash
   git clone https://github.com/senarzuniga/adaptive-sales-engine.git
   cd adaptive-sales-engine
   python -m venv .venv
   .venv\Scripts\activate  # Windows
   pip install -r requirements.txt
   ```
2. **Lanza la aplicación en modo local**:
   ```bash
   streamlit run streamlit_app.py
   ```
3. **Explora los módulos desde el Dashboard** y revisa los paneles de onboarding de cada sección.
4. **Lee el código de `/domain/` y `/ui/pages/`** para entender la arquitectura y los patrones de agentes.
5. **Consulta los archivos de configuración y ejemplos en `/config.py` y `/scripts/`**.

## Reglas de Contribución
- Sigue el patrón modular y la nomenclatura existente.
- Prioriza la trazabilidad, la automatización y la experiencia de usuario.
- Documenta cada nuevo módulo, agente o integración.
- Usa `width='stretch'` en todos los componentes Streamlit.
- Realiza pruebas funcionales antes de cada commit.

## Contacto y Soporte
Para dudas técnicas, revisa primero este README y los docstrings. Si necesitas soporte adicional, contacta con el arquitecto principal o abre un issue en GitHub.

---
**Adaptive Sales Engine** es una plataforma viva: cada mejora debe orientarse a maximizar la productividad, la trazabilidad y la facilidad de uso para todos los usuarios y desarrolladores.
