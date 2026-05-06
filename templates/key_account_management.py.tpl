# TEMPLATE_META: Key Account Management
# TEMPLATE_PAGE_KEY: key_account_management
# TEMPLATE_NAV_LABEL: 🏆 Key Account Management
# TEMPLATE_IMPROVEMENT: Protocolo KAM + health score + alertas de riesgo + tabla de cuentas clave
# TEMPLATE_MATURITY_BEFORE: 0
# TEMPLATE_MATURITY_AFTER: 65

def page_key_account_management() -> None:
    st.header("🏆 Key Account Management")
    st.caption("Referencia: Gainsight · Salesforce CRM · HubSpot Sales Hub")

    with st.expander("📋 Protocolo KAM estándar (referencia: Gainsight + Salesforce)", expanded=False):
        protocol_steps = [
            "1. Identificar cuentas estratégicas (Top 20% de ingresos)",
            "2. Mapear stakeholders y niveles de influencia",
            "3. Evaluar Customer Health Score (NPS, frecuencia de contacto, satisfacción)",
            "4. Crear Joint Business Plan con objetivos compartidos",
            "5. Planificar acciones: meetings trimestrales, follow-ups mensuales, upselling",
            "6. Revisión periódica del plan y activar alertas de riesgo",
        ]
        for step in protocol_steps:
            st.checkbox(step, key=f"kam_proto_{step[:30]}")

    if "kam_accounts" not in st.session_state:
        st.session_state.kam_accounts = pd.DataFrame(
            {
                "Cuenta": ["Volkswagen Group", "Siemens AG", "SEAT S.A.", "Schneider Electric", "ABB Ltd"],
                "Ingreso_anual_€": [420000, 310000, 280000, 195000, 160000],
                "Health_Score": [82, 71, 45, 90, 63],
                "NPS": [8, 6, -2, 9, 4],
                "Días_sin_contacto": [12, 8, 35, 5, 42],
                "Responsable": ["Ana García", "Carlos López", "Ana García", "Pedro Martín", "Carlos López"],
            }
        )

    df = st.session_state.kam_accounts.copy()

    st.subheader("📊 Mis cuentas clave")

    col_a, col_b, col_c = st.columns(3)
    col_a.metric("Cuentas gestionadas", len(df))
    col_b.metric("Ingreso total gestionado", f"€{df['Ingreso_anual_€'].sum():,.0f}")
    col_c.metric("Health Score promedio", f"{df['Health_Score'].mean():.0f}/100")

    def _health_color(score: int) -> str:
        if score >= 75:
            return "🟢"
        if score >= 55:
            return "🟡"
        return "🔴"

    df["Estado"] = df["Health_Score"].apply(_health_color)
    st.dataframe(
        df[["Estado", "Cuenta", "Ingreso_anual_€", "Health_Score", "NPS", "Días_sin_contacto", "Responsable"]].style.format(
            {"Ingreso_anual_€": "€{:,.0f}"}
        ).background_gradient(subset=["Health_Score"], cmap="RdYlGn"),
        use_container_width=True,
    )

    st.subheader("🚨 Alertas automáticas")
    alertas = []
    for _, row in df.iterrows():
        if row["NPS"] < 0:
            alertas.append(f"🔴 **{row['Cuenta']}**: NPS negativo ({row['NPS']}). Reunión de recuperación urgente.")
        if row["Días_sin_contacto"] > 30:
            alertas.append(f"🟡 **{row['Cuenta']}**: Sin contacto hace {row['Días_sin_contacto']} días. Sugerir follow-up.")
        if row["Health_Score"] < 55:
            alertas.append(f"🔴 **{row['Cuenta']}**: Health Score crítico ({row['Health_Score']}/100). Activar plan de recuperación.")

    if alertas:
        for alerta in alertas:
            st.warning(alerta)
    else:
        st.success("✅ Todas las cuentas clave están dentro de parámetros saludables.")

    with st.expander("📈 Visualización de health scores"):
        fig = px.bar(
            df.sort_values("Health_Score"),
            x="Health_Score",
            y="Cuenta",
            orientation="h",
            color="Health_Score",
            color_continuous_scale=["#ff4b4b", "#ffa500", "#00cc66"],
            range_color=[0, 100],
            title="Customer Health Score por cuenta clave",
        )
        fig.add_vline(x=60, line_dash="dash", line_color="red", annotation_text="Umbral crítico: 60")
        st.plotly_chart(fig, use_container_width=True)

    st.download_button(
        "⬇️ Exportar cuentas clave",
        data=df.to_csv(index=False),
        file_name=f"key_accounts_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv",
        mime="text/csv",
        use_container_width=True,
    )
