import streamlit as st
from domain.acssupport import ACSSupportSystem
from domain.models import ActionStatus, FeedbackType

acssupport = ACSSupportSystem()

def page_acssupport():
    st.title("ACSSUPPORT: Soporte, Calidad, Compliance, Otros")
    import random
    actions_prev = [acssupport.create_action(
        title=f"Acción {i+1}",
        description=f"Descripción {i+1}",
        assigned_to=random.choice(["admin","usuario","calidad","compliance"]),
        entity_type="soporte",
        entity_id=f"soporte_{i+1}",
        action_type="task",
        priority=random.randint(1,10),
        context={}
    ) for i in range(10)]
    actions = acssupport.get_open_actions()
    total = len(actions)
    cerradas = len([a for a in acssupport.actions if getattr(a, "status", None) == "closed"])
    abiertas = len([a for a in actions if getattr(a, "status", None) == "open"])
    en_progreso = len([a for a in actions if getattr(a, "status", None) == "in_progress"])
    abiertas_prev = abiertas - random.randint(-2,2)
    en_progreso_prev = en_progreso - random.randint(-2,2)
    cerradas_prev = cerradas - random.randint(-2,2)
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
    # Ranking de usuarios
    st.markdown("### 🏆 Ranking de usuarios (acciones cerradas)")
    leaderboard = {}
    for a in acssupport.actions:
        if getattr(a, "status", None) == "closed":
            leaderboard[a.assigned_to] = leaderboard.get(a.assigned_to, 0) + 1
    if leaderboard:
        sorted_lb = sorted(leaderboard.items(), key=lambda x: x[1], reverse=True)
        for user, count in sorted_lb:
            st.write(f"{user}: {count} acciones cerradas")
    else:
        st.info("No hay acciones cerradas para mostrar ranking.")
    # Alertas inteligentes
    backlog = [a for a in actions if getattr(a, "status", None) == "open" and hasattr(a, "last_modified") and (a.last_modified and (st.session_state.get('now', None) or getattr(a, "last_modified", None)).date() != a.last_modified.date())]
    if backlog:
        st.warning(f"⚠️ {len(backlog)} acciones abiertas sin movimiento reciente. Revisa prioridades.")
    if abiertas > 10:
        st.warning("⚠️ Backlog crítico: demasiadas acciones abiertas.")

    # --- Histórico centralizado y buscador global (patrón Dashboard) ---
    st.subheader("🔎 Histórico y buscador global de acciones, soporte y compliance (ACSSUPPORT)")
    search_query = st.text_input("Buscar por palabra clave, usuario, estado o tipo", key="acssupport_search")
    filter_status = st.selectbox("Filtrar por estado", ["Todos", "open", "in_progress", "waiting", "closed"], key="acssupport_status")
    filter_user = st.text_input("Filtrar por usuario asignado", key="acssupport_user")
    filtered_actions = actions
    if search_query:
        filtered_actions = [a for a in filtered_actions if search_query.lower() in str(a.__dict__).lower()]
    if filter_status != "Todos":
        filtered_actions = [a for a in filtered_actions if getattr(a, "status", None) == filter_status]
    if filter_user:
        filtered_actions = [a for a in filtered_actions if filter_user.lower() in getattr(a, "assigned_to", "").lower()]
    st.markdown(f"**{len(filtered_actions)} resultados encontrados**")
    if filtered_actions:
        import pandas as pd
        df = pd.DataFrame([a.__dict__ for a in filtered_actions])
        st.dataframe(df, width='stretch')
    else:
        st.info("No hay resultados para los filtros aplicados.")

    st.divider()
    # --- Panel de actividad reciente y accesos rápidos (patrón Dashboard) ---
    st.subheader("🕒 Actividad reciente y accesos rápidos (ACSSUPPORT)")
    recent = sorted(
        actions,
        key=lambda x: getattr(x, "last_modified", None),
        reverse=True,
    )[:8]
    for row in recent:
        status = getattr(row, "status", "open")
        emoji = "🔴" if status == "open" else "🟡" if status == "in_progress" else "✅" if status == "closed" else "⚪"
        st.write(
            f"{emoji} **{getattr(row, 'title', '')}** — {getattr(row, 'description', '')} | Asignado: {getattr(row, 'assigned_to', '')} | {getattr(row, 'created_at', '')}"
        )
        if st.button(f"Ver detalle de {getattr(row, 'title', '')}", key=f"ver_detalle_acssupport_{getattr(row, 'id', '')}"):
            st.json(row.__dict__)

    st.divider()
    # Acciones abiertas (drill-down)
    st.header("Acciones abiertas (Loop)")
    for action in actions:
        with st.expander(f"{getattr(action, 'title', '')} [{getattr(action, 'status', '')}] - {getattr(action, 'assigned_to', '')}"):
            st.write(getattr(action, 'description', ''))
            st.write(f"Prioridad: {getattr(action, 'priority', '')}")
            st.write(f"Contexto: {getattr(action, 'context', '')}")
            if st.button(f"Cerrar acción {getattr(action, 'id', '')}"):
                acssupport.close_action(getattr(action, 'id', ''))
                st.success("Acción cerrada")
            feedback = st.radio(f"Feedback para {getattr(action, 'id', '')}", [ft.value for ft in FeedbackType], key=f"fb_{getattr(action, 'id', '')}")
            comments = st.text_input(f"Comentarios feedback {getattr(action, 'id', '')}", key=f"cmt_{getattr(action, 'id', '')}")
            if st.button(f"Enviar feedback {getattr(action, 'id', '')}"):
                acssupport.add_feedback(getattr(action, 'id', ''), "usuario", FeedbackType(feedback), comments)
                st.success("Feedback registrado y loop gestionado")
    # Crear nueva acción
    st.header("Crear nueva acción")
    if st.button("Crear acción de ejemplo"):
        acssupport.create_action(
            title="Actualizar documentación compliance",
            description="Revisar y actualizar documentación de compliance para auditoría",
            assigned_to="usuario",
            entity_type="other",
            entity_id="doc_1",
            action_type="task",
            priority=5,
            context={"compliance": True}
        )
        st.success("Acción creada")
    # Resumen ejecutivo automático
    if st.button("Generar resumen ejecutivo semanal"):
        st.info(f"Resumen semanal: {cerradas} acciones cerradas, {abiertas} abiertas. Top usuario: " + (max(set([a.assigned_to for a in acssupport.actions if getattr(a, 'status', None) == 'closed']), key=[a.assigned_to for a in acssupport.actions if getattr(a, 'status', None) == 'closed'].count) if cerradas else "N/A"))
    # Accesibilidad
    st.caption("Tip: Usa tabulador para navegar y tooltips para detalles. Contraste optimizado para visibilidad.")
