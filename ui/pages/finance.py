import streamlit as st
from domain.finance import FinanceSystem
from domain.models import ActionStatus, FeedbackType

finance = FinanceSystem()

def page_finance():
    st.title("Finanzas y Administración")
    actions = finance.get_open_actions()

    # --- Histórico centralizado y buscador global (patrón Dashboard) ---
    st.subheader("🔎 Histórico y buscador global de acciones, facturación y administración (Finanzas)")
    search_query = st.text_input("Buscar por palabra clave, usuario, estado o tipo", key="finance_search")
    filter_status = st.selectbox("Filtrar por estado", ["Todos", "open", "in_progress", "waiting", "closed"], key="finance_status")
    filter_user = st.text_input("Filtrar por usuario asignado", key="finance_user")
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
    st.subheader("🕒 Actividad reciente y accesos rápidos (Finanzas)")
    recent = sorted(
        actions,
        key=lambda x: getattr(x, "last_modified", None),
        reverse=True,
    )[:8]
    for row in recent:
        status = getattr(row, "status", "open")
        emoji = "🔴" if status == "open" else "🟡" if status == "in_progress" else "✅" if status == "closed" else "⚪"
        st.write(
            f"{emoji} **{getattr(row, 'title', '') if hasattr(row, 'title') else getattr(row, 'name', '')}** — {getattr(row, 'description', '')} | Asignado: {getattr(row, 'assigned_to', '')} | {getattr(row, 'created_at', '')}"
        )
        if st.button(f"Ver detalle de {getattr(row, 'title', getattr(row, 'name', ''))}", key=f"ver_detalle_finance_{getattr(row, 'id', '')}"):
            st.json(row.__dict__)

    st.divider()
    st.header("Acciones abiertas (Loop)")
    for action in actions:
        with st.expander(f"{action.title} [{action.status}] - {action.assigned_to}"):
            st.write(action.description)
            st.write(f"Prioridad: {action.priority}")
            st.write(f"Contexto: {action.context}")
            if st.button(f"Cerrar acción {action.id}"):
                finance.close_action(action.id)
                st.success("Acción cerrada")
            feedback = st.radio(f"Feedback para {action.id}", [ft.value for ft in FeedbackType], key=f"fb_{action.id}")
            comments = st.text_input(f"Comentarios feedback {action.id}", key=f"cmt_{action.id}")
            if st.button(f"Enviar feedback {action.id}"):
                finance.add_feedback(action.id, "usuario", FeedbackType(feedback), comments)
                st.success("Feedback registrado y loop gestionado")
    st.header("Crear nueva acción")
    if st.button("Crear acción de ejemplo"):
        finance.create_action(
            title="Reclamar factura pendiente",
            description="Enviar recordatorio de pago a cliente Y",
            assigned_to="usuario",
            entity_type="client",
            entity_id="client_1",
            action_type="email",
            priority=7,
            context={"factura": "F1234"}
        )
        st.success("Acción creada")
