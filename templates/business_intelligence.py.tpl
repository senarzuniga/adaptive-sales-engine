# TEMPLATE_META: Business Intelligence
# TEMPLATE_PAGE_KEY: business_intelligence
# TEMPLATE_NAV_LABEL: 📊 Business Intelligence
# TEMPLATE_IMPROVEMENT: KPI dashboard + tendencias + informes programados + exploración por segmento
# TEMPLATE_MATURITY_BEFORE: 0
# TEMPLATE_MATURITY_AFTER: 62

def page_business_intelligence() -> None:
    st.header("📊 Business Intelligence")
    st.caption("Referencia: Looker · Domo · ThoughtSpot")

    with st.expander("📋 Protocolo BI estándar (referencia: Looker + Domo)", expanded=False):
        protocol_steps = [
            "1. Conectar fuentes de datos (CRM, ERP, base de datos propia)",
            "2. Definir métricas y KPIs con definición única acordada",
            "3. Segmentar dashboards por audiencia (dirección, comercial, operaciones)",
            "4. Configurar alertas sobre umbrales críticos",
            "5. Programar distribución automática de informes",
            "6. Capacitar al equipo en exploración autoservicio",
        ]
        for step in protocol_steps:
            st.checkbox(step, key=f"bi_proto_{step[:30]}")

    period = st.selectbox("Período de análisis", ["Últimos 7 días", "Últimos 30 días", "Trimestre actual", "Año actual"], key="bi_period")

    period_multiplier = {"Últimos 7 días": 0.25, "Últimos 30 días": 1.0, "Trimestre actual": 3.0, "Año actual": 12.0}
    mult = period_multiplier.get(period, 1.0)

    base_revenue = 487000 * mult
    base_offers = int(23 * mult)
    base_win_rate = 34.8
    base_avg_deal = 21200

    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Revenue generado", f"€{base_revenue:,.0f}", delta=f"+{base_revenue * 0.08:,.0f} vs período anterior")
    m2.metric("Ofertas enviadas", base_offers, delta=f"+{int(base_offers * 0.12)} vs período anterior")
    m3.metric("Win rate", f"{base_win_rate:.1f}%", delta="+2.3pp vs período anterior")
    m4.metric("Ticket medio", f"€{base_avg_deal:,.0f}", delta=f"+€{int(base_avg_deal * 0.05):,} vs período anterior")

    st.subheader("📈 Tendencias por segmento")

    import numpy as np  # noqa: PLC0415

    months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun"]
    rng = np.random.default_rng(42)
    df_trend = pd.DataFrame(
        {
            "Mes": months,
            "Automatización": rng.integers(60000, 120000, 6).tolist(),
            "Servicios": rng.integers(40000, 90000, 6).tolist(),
            "Componentes": rng.integers(30000, 70000, 6).tolist(),
        }
    )

    df_melted = df_trend.melt(id_vars="Mes", var_name="Segmento", value_name="Revenue")
    fig_trend = px.line(
        df_melted,
        x="Mes",
        y="Revenue",
        color="Segmento",
        markers=True,
        title="Evolución del revenue por segmento de producto",
        labels={"Revenue": "Revenue (€)"},
    )
    st.plotly_chart(fig_trend, use_container_width=True)

    col_left, col_right = st.columns(2)

    with col_left:
        st.subheader("🏆 Top 5 cuentas por revenue")
        rng2 = np.random.default_rng(7)
        df_top = pd.DataFrame(
            {
                "Cuenta": ["Volkswagen", "Siemens", "SEAT", "Schneider", "ABB"],
                "Revenue_€": sorted(rng2.integers(80000, 250000, 5).tolist(), reverse=True),
            }
        )
        fig_top = px.bar(df_top, x="Revenue_€", y="Cuenta", orientation="h", color="Revenue_€",
                         color_continuous_scale="Blues", title="Top 5 cuentas")
        st.plotly_chart(fig_top, use_container_width=True)

    with col_right:
        st.subheader("📊 Distribución de estados de ofertas")
        df_status = pd.DataFrame(
            {"Estado": ["Ganadas", "En negociación", "Perdidas", "Expiradas"], "Cantidad": [8, 7, 4, 4]}
        )
        fig_pie = px.pie(df_status, values="Cantidad", names="Estado",
                         color_discrete_sequence=["#00cc66", "#ffa500", "#ff4b4b", "#999999"],
                         title="Pipeline de ofertas")
        st.plotly_chart(fig_pie, use_container_width=True)

    st.subheader("⏰ Informes programados")
    with st.expander("Configurar informe automático"):
        report_freq = st.selectbox("Frecuencia", ["Diario", "Semanal (lunes)", "Mensual (día 1)"], key="bi_report_freq")
        report_recipients = st.text_input("Destinatarios (emails separados por coma)", key="bi_report_recipients")
        if st.button("💾 Guardar configuración de informe", key="bi_save_report"):
            st.success(f"✅ Informe {report_freq} configurado para: {report_recipients or '(ninguno)'}")

    st.subheader("🔍 Exploración de datos")
    query_example = st.selectbox(
        "Consulta rápida",
        [
            "¿Cuáles son mis 5 clientes con más revenue este mes?",
            "¿Qué segmento tiene la mayor tasa de crecimiento?",
            "¿Cuántas ofertas están en riesgo de expirar esta semana?",
            "¿Cuál es el win rate por comercial?",
        ],
        key="bi_query",
    )
    if st.button("▶️ Ejecutar consulta", key="bi_run_query"):
        st.info(f"💡 Consulta: *{query_example}* — Integra tu fuente de datos real para obtener respuestas en tiempo real.")
