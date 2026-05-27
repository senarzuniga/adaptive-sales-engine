
import streamlit as st
import random
from datetime import datetime, timedelta
from domain.models import Action, Feedback, FeedbackType
import plotly.express as px

def cargar_datos_demo():
    usuarios = ["admin", "comercial", "ofertas", "compras", "costes"]
    acciones = []
    for i in range(20):
        acciones.append(Action(
            id=str(i+1),
            name=f"Acción {i+1}",
            goal=random.choice(["Captar cliente", "Cerrar oferta", "Negociar compra", "Reducir costes", "Mejorar servicio"]),
            description=f"Descripción de la acción {i+1}",
            department=random.choice(["Comercial", "Ofertas", "Compras", "Costes", "Servicio"]),
            assigned_to=random.choice(usuarios),
            status=random.choices(["open", "in_progress", "waiting", "closed"], weights=[0.2,0.3,0.2,0.3])[0],
            comments="",
            importance_score=random.randint(50,100),
            strategy_alignment=random.randint(50,100),
            estimated_hours=random.uniform(1,10),
            created_by=random.choice(usuarios),
            created_at=datetime.now() - timedelta(days=random.randint(0,30)),
            last_modified=datetime.now() - timedelta(days=random.randint(0,10))
        ))
    feedbacks = [Feedback(
        action_id=str(random.randint(1,20)),
        user=random.choice(usuarios),
        feedback_type=random.choice(list(FeedbackType)),
        comments="Feedback demo",
        created_at=datetime.now() - timedelta(days=random.randint(0,10))
    ) for _ in range(10)]
    return acciones, feedbacks

def panel_reportes(acciones, acciones_prev=None):
    st.subheader("📊 KPIs y Reporting")
    total = len(acciones)
    abiertas = len([a for a in acciones if a.status == "open"])
    en_progreso = len([a for a in acciones if a.status == "in_progress"])
    cerradas = len([a for a in acciones if a.status == "closed"])
    # Simulación de valores previos para tendencia
    if acciones_prev is None:
        abiertas_prev = abiertas - random.randint(-2,2)
        en_progreso_prev = en_progreso - random.randint(-2,2)
        cerradas_prev = cerradas - random.randint(-2,2)
    else:
        abiertas_prev = len([a for a in acciones_prev if a.status == "open"])
        en_progreso_prev = len([a for a in acciones_prev if a.status == "in_progress"])
        cerradas_prev = len([a for a in acciones_prev if a.status == "closed"])
    # Semáforos
    def color(val, prev):
        if val > prev:
            return "🟢"
        elif val < prev:
            return "🔴"
        else:
            return "🟡"
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total acciones", total)
    c2.metric("Abiertas", abiertas, f"{abiertas-abiertas_prev:+d}")
    c2.write(color(abiertas, abiertas_prev))
    c3.metric("En progreso", en_progreso, f"{en_progreso-en_progreso_prev:+d}")
    c3.write(color(en_progreso, en_progreso_prev))
    c4.metric("Cerradas", cerradas, f"{cerradas-cerradas_prev:+d}")
    c4.write(color(cerradas, cerradas_prev))
    fig = px.pie(names=["Abiertas","En progreso","Cerradas"], values=[abiertas,en_progreso,cerradas], title="Distribución de acciones")
    st.plotly_chart(fig, width='stretch')
    # Leaderboard
    st.markdown("### 🏆 Ranking de usuarios (acciones cerradas)")
    leaderboard = {}
    for a in acciones:
        if a.status == "closed":
            leaderboard[a.assigned_to] = leaderboard.get(a.assigned_to, 0) + 1
    if leaderboard:
        sorted_lb = sorted(leaderboard.items(), key=lambda x: x[1], reverse=True)
        for user, count in sorted_lb:
            st.write(f"{user}: {count} acciones cerradas")
    else:
        st.info("No hay acciones cerradas para mostrar ranking.")
    # Alertas inteligentes
    backlog = [a for a in acciones if a.status == "open" and (datetime.now()-a.last_modified).days > 2]
    if backlog:
        st.warning(f"⚠️ {len(backlog)} acciones abiertas sin movimiento >48h. Revisa prioridades.")
    if abiertas > 10:
        st.warning("⚠️ Backlog crítico: demasiadas acciones abiertas.")

def panel_recomendaciones(acciones, user_role=None):
    st.subheader("🤖 Recomendaciones inteligentes")
    abiertas = [a for a in acciones if a.status == "open"]
    if abiertas:
        sugerida = max(abiertas, key=lambda a: a.importance_score + a.strategy_alignment)
        st.info(f"Prioriza la acción: {sugerida.name} (Importancia: {sugerida.importance_score}, Estrategia: {sugerida.strategy_alignment})")
        # Recomendaciones por rol
        if user_role == "admin":
            st.info("Como admin, revisa el backlog y asigna recursos a las acciones más críticas.")
        elif user_role == "comercial":
            st.info("Como comercial, prioriza captar clientes de alto valor y cierra ofertas abiertas.")
        elif user_role == "costes":
            st.info("Como costes, revisa acciones de reducción y eficiencia.")
    else:
        st.info("No hay acciones abiertas para recomendar.")

def page_crm():
    st.header("CRM: Gestión Comercial y Clientes")
    # Simulación de datos previos para tendencia
    acciones_prev, _ = cargar_datos_demo()
    acciones, feedbacks = cargar_datos_demo()
    # Personalización por rol
    profile = st.session_state.get("profile") or {}
    user_role = profile.get("role", "comercial")
    panel_reportes(acciones, acciones_prev)
    panel_recomendaciones(acciones, user_role)

    # --- Histórico centralizado y buscador global (patrón Dashboard) ---
    st.subheader("🔎 Histórico y buscador global de acciones, contactos y comunicaciones (CRM)")
    search_query = st.text_input("Buscar por palabra clave, usuario, estado o tipo", key="crm_search")
    filter_status = st.selectbox("Filtrar por estado", ["Todos", "open", "in_progress", "waiting", "closed"], key="crm_status")
    filter_user = st.text_input("Filtrar por usuario asignado", key="crm_user")
    filtered_acciones = acciones
    if search_query:
        filtered_acciones = [a for a in filtered_acciones if search_query.lower() in str(a.__dict__).lower()]
    if filter_status != "Todos":
        filtered_acciones = [a for a in filtered_acciones if a.status == filter_status]
    if filter_user:
        filtered_acciones = [a for a in filtered_acciones if filter_user.lower() in a.assigned_to.lower()]
    st.markdown(f"**{len(filtered_acciones)} resultados encontrados**")
    if filtered_acciones:
        import pandas as pd
        df = pd.DataFrame([a.__dict__ for a in filtered_acciones])
        st.dataframe(df, width='stretch')
    else:
        st.info("No hay resultados para los filtros aplicados.")

    st.divider()
    # --- Panel de actividad reciente y accesos rápidos (patrón Dashboard) ---
    st.subheader("🕒 Actividad reciente y accesos rápidos (CRM)")
    recent = sorted(
        acciones,
        key=lambda x: x.last_modified,
        reverse=True,
    )[:8]
    for row in recent:
        status = row.status
        emoji = "🔴" if status == "open" else "🟡" if status == "in_progress" else "✅" if status == "closed" else "⚪"
        st.write(
            f"{emoji} **{row.name}** — {row.goal} | Asignado: {row.assigned_to} | {row.created_at:%Y-%m-%d}"
        )
        if st.button(f"Ver detalle de {row.name}", key=f"ver_detalle_crm_{row.id}"):
            st.json(row.__dict__)

    st.divider()
    # --- Acciones abiertas (Loop) ---
    st.subheader("Acciones abiertas (Loop)")
    abiertas = [a for a in acciones if a.status == "open"]
    for a in abiertas:
        with st.expander(f"{a.name} | {a.goal} | {a.department} | Asignado: {a.assigned_to} | Importancia: {a.importance_score}"):
            st.write(f"Descripción: {a.description}")
            st.write(f"Creada: {a.created_at:%Y-%m-%d}")
            st.write(f"Última modificación: {a.last_modified:%Y-%m-%d}")
            st.write(f"Estrategia: {a.strategy_alignment}")
            st.write(f"Horas estimadas: {a.estimated_hours:.1f}")
            st.button("Marcar como cerrada", key=f"close_{a.id}")

    st.subheader("Crear nueva acción")
    if st.button("Crear acción de ejemplo"):
        st.success("Acción de ejemplo creada.")
    # Resumen ejecutivo automático
    if st.button("Generar resumen ejecutivo semanal"):
        cerradas = [a for a in acciones if a.status == "closed"]
        abiertas = [a for a in acciones if a.status == "open"]
        st.info(f"Resumen semanal: {len(cerradas)} acciones cerradas, {len(abiertas)} abiertas. Top usuario: " + (max(set([a.assigned_to for a in cerradas]), key=[a.assigned_to for a in cerradas].count) if cerradas else "N/A"))
    # Accesibilidad: tooltips y contraste
    st.caption("Tip: Usa tabulador para navegar y tooltips para detalles. Contraste optimizado para visibilidad.")
