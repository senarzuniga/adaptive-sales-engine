# TEMPLATE_META: Budget Command Center
# TEMPLATE_PAGE_KEY: budget_command_center
# TEMPLATE_NAV_LABEL: 💰 Budget Command Center
# TEMPLATE_IMPROVEMENT: Simulación what-if con sliders + alertas de desviación + exportación de escenarios
# TEMPLATE_MATURITY_BEFORE: 0
# TEMPLATE_MATURITY_AFTER: 68

def page_budget_command_center() -> None:
    st.header("💰 Budget Command Center")
    st.caption("Referencia: Anaplan · Vareto · Cube")

    with st.expander("📋 Protocolo profesional (Anaplan-style)", expanded=False):
        protocol = [
            "1. Definir supuestos del período (inflación, crecimiento, inversiones)",
            "2. Cargar presupuesto base por departamento / línea de producto",
            "3. Simular escenarios optimista / base / pesimista",
            "4. Revisar y aprobar con flujo multi-rol",
            "5. Activar tracking mensual real vs. presupuestado",
            "6. Re-forecast trimestral con datos acumulados",
        ]
        for step in protocol:
            st.checkbox(step, key=f"bcc_proto_{step[:20]}")

    if "bcc_data" not in st.session_state:
        st.session_state.bcc_data = pd.DataFrame(
            {
                "Producto": ["Automatización Industrial", "Servicios de Campo", "Componentes Eléctricos"],
                "Presupuesto_inicial": [300000, 180000, 220000],
                "Real_actual": [285000, 195000, 210000],
            }
        )

    df = st.session_state.bcc_data.copy()

    st.subheader("📊 Escenario What-If")
    col1, col2, col3 = st.columns(3)
    with col1:
        ajuste_a = st.slider(f"Ajuste {df.iloc[0]['Producto']} (%)", -30, 30, 0, key="bcc_adj_a")
    with col2:
        ajuste_b = st.slider(f"Ajuste {df.iloc[1]['Producto']} (%)", -30, 30, 0, key="bcc_adj_b")
    with col3:
        ajuste_c = st.slider(f"Ajuste {df.iloc[2]['Producto']} (%)", -30, 30, 0, key="bcc_adj_c")

    df_sim = df.copy()
    df_sim.loc[0, "Presupuesto_inicial"] *= 1 + ajuste_a / 100
    df_sim.loc[1, "Presupuesto_inicial"] *= 1 + ajuste_b / 100
    df_sim.loc[2, "Presupuesto_inicial"] *= 1 + ajuste_c / 100
    df_sim["Desviación_€"] = df_sim["Real_actual"] - df_sim["Presupuesto_inicial"]
    df_sim["Desviación_%"] = (df_sim["Desviación_€"] / df_sim["Presupuesto_inicial"] * 100).round(1)

    st.dataframe(
        df_sim.style.format(
            {"Presupuesto_inicial": "€{:,.0f}", "Real_actual": "€{:,.0f}", "Desviación_€": "€{:,.0f}", "Desviación_%": "{:+.1f}%"}
        ).bar(subset=["Desviación_€"], color=["#ff9999", "#00cc66"]),
        use_container_width=True,
    )

    total_presupuestado = df_sim["Presupuesto_inicial"].sum()
    total_real = df_sim["Real_actual"].sum()
    desviacion_total = total_real - total_presupuestado

    m1, m2, m3 = st.columns(3)
    m1.metric("Total Presupuestado", f"€{total_presupuestado:,.0f}")
    m2.metric("Total Real", f"€{total_real:,.0f}")
    m3.metric("Desviación Global", f"€{desviacion_total:,.0f}", delta=f"{desviacion_total / total_presupuestado * 100:+.1f}%")

    desviaciones_criticas = df_sim[abs(df_sim["Desviación_%"]) > 10]
    if not desviaciones_criticas.empty:
        st.warning(
            f"⚠️ **Alerta de desviación >10%** en: {', '.join(desviaciones_criticas['Producto'].tolist())}. "
            "Revisar y actualizar el forecast."
        )
    else:
        st.success("✅ Todas las líneas dentro del umbral de desviación (<10%)")

    with st.expander("📈 Gráfico de desviaciones"):
        fig = px.bar(
            df_sim,
            x="Producto",
            y="Desviación_%",
            color="Desviación_%",
            color_continuous_scale=["#ff4b4b", "#ffa500", "#00cc66"],
            title="Desviación presupuestaria por línea (%)",
            labels={"Desviación_%": "Desviación (%)"},
        )
        fig.add_hline(y=10, line_dash="dash", line_color="red", annotation_text="Umbral +10%")
        fig.add_hline(y=-10, line_dash="dash", line_color="red", annotation_text="Umbral -10%")
        st.plotly_chart(fig, use_container_width=True)

    st.subheader("📤 Exportar escenario")
    csv = df_sim.to_csv(index=False)
    st.download_button(
        "⬇️ Descargar escenario como CSV",
        data=csv,
        file_name=f"budget_scenario_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.csv",
        mime="text/csv",
        use_container_width=True,
    )
