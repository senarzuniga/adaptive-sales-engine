import json
import os
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

import streamlit as st


REPO_ROOT = Path(__file__).resolve().parent.parent


def load_env_values() -> dict[str, str]:
    values: dict[str, str] = {}
    for env_name in [".env", ".env.local"]:
        env_path = REPO_ROOT / env_name
        if not env_path.exists():
            continue
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def get_supabase_settings() -> tuple[str | None, str | None]:
    env = load_env_values()
    url = os.getenv("SUPABASE_URL") or env.get("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL") or env.get("VITE_SUPABASE_URL")
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or env.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY")
        or env.get("VITE_SUPABASE_PUBLISHABLE_KEY")
    )
    return url, key


def fetch_rows(table: str, *, select: str = "*", limit: int = 100, order: str | None = None, **filters):
    url, key = get_supabase_settings()
    if not url or not key:
        raise RuntimeError("Missing Supabase URL or key in environment settings.")

    query_parts = [f"select={quote(select, safe='*,().')}", f"limit={limit}"]
    if order:
        query_parts.append(f"order={quote(order, safe='.')}")
    for name, value in filters.items():
        query_parts.append(f"{quote(name)}=eq.{quote(str(value))}")

    request = Request(
        f"{url}/rest/v1/{table}?{'&'.join(query_parts)}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    )

    with urlopen(request) as response:
        return json.loads(response.read().decode("utf-8"))


def build_graph(relationships: list[dict]) -> str:
    if not relationships:
        return "digraph G { \"No relationships yet\" }"

    lines = ["digraph G {", "rankdir=LR;"]
    for row in relationships[:30]:
        left = str(row.get("from_entity_id", "source")).replace('"', "'")
        right = str(row.get("to_entity_id", "target")).replace('"', "'")
        label = str(row.get("relation_type", "related_to")).replace('"', "'")
        lines.append(f'"{left}" -> "{right}" [label="{label}"];')
    lines.append("}")
    return "\n".join(lines)


st.set_page_config(page_title="Document Ingestion Monitor", layout="wide")
st.title("Document Ingestion Monitor")
st.caption("Five-layer ingestion audit, traceability, and storage preview")

try:
    docs = fetch_rows("document_ingestion_overview", order="created_at.desc", limit=200)
except Exception as exc:
    st.error(f"Unable to load Supabase ingestion data: {exc}")
    st.stop()

with st.sidebar:
    st.header("Uploaded documents")
    status_filter = st.multiselect(
        "Processing status",
        options=sorted({row.get("processing_status", "unknown") for row in docs}),
        default=sorted({row.get("processing_status", "unknown") for row in docs}),
    )
    filtered_docs = [row for row in docs if row.get("processing_status", "unknown") in status_filter]
    selected = st.selectbox(
        "Select a document",
        options=filtered_docs,
        format_func=lambda row: f"{row.get('file_name', 'document')} · {row.get('processing_status', 'unknown')}",
    ) if filtered_docs else None

if not selected:
    st.info("No documents available for the selected filters.")
    st.stop()

document_id = selected["document_id"]
sections = fetch_rows("document_sections", document_id=document_id, order="order_index.asc", limit=300)
chunks = fetch_rows("document_chunks", document_id=document_id, order="created_at.desc", limit=300)
entities = fetch_rows("knowledge_entities", document_id=document_id, order="created_at.desc", limit=300)
relationships = fetch_rows("knowledge_relationships", document_id=document_id, order="created_at.desc", limit=300)
insights = fetch_rows("knowledge_insights", document_id=document_id, order="created_at.desc", limit=300)
data_points = fetch_rows("knowledge_data_points", document_id=document_id, order="created_at.desc", limit=300)
runs = fetch_rows("document_ingestion_runs", document_id=document_id, order="started_at.desc", limit=50)

col1, col2, col3, col4, col5 = st.columns(5)
col1.metric("Sections", selected.get("section_count", 0))
col2.metric("Chunks", selected.get("chunk_count", 0))
col3.metric("Entities", selected.get("entity_count", 0))
col4.metric("Relationships", selected.get("relationship_count", 0))
col5.metric("Quality score", selected.get("quality_score", "n/a"))

st.subheader("Parsed structure")
st.json([
    {
        "heading": row.get("heading"),
        "level": row.get("level"),
        "type": row.get("section_type"),
        "semantic_context": row.get("semantic_context"),
    }
    for row in sections
])

left, right = st.columns([1.2, 1])

with left:
    st.subheader("Entities")
    st.dataframe([
        {
            "name": row.get("canonical_name"),
            "type": row.get("entity_type"),
            "confidence": row.get("confidence"),
            "context": row.get("semantic_context"),
        }
        for row in entities
    ], use_container_width=True)

    st.subheader("Data points")
    st.dataframe([
        {
            "metric": row.get("metric_name"),
            "value": row.get("metric_value_text"),
            "numeric": row.get("metric_value_num"),
            "unit": row.get("unit"),
            "confidence": row.get("confidence"),
        }
        for row in data_points
    ], use_container_width=True)

with right:
    st.subheader("Relationships graph")
    st.graphviz_chart(build_graph(relationships))

    st.subheader("Processing runs")
    st.dataframe([
        {
            "status": row.get("status"),
            "pipeline": row.get("pipeline_version"),
            "quality": row.get("quality_score"),
            "summary": row.get("summary"),
            "completed_at": row.get("completed_at"),
        }
        for row in runs
    ], use_container_width=True)

st.subheader("Insights preview")
st.dataframe([
    {
        "type": row.get("insight_type"),
        "summary": row.get("summary"),
        "confidence": row.get("confidence"),
    }
    for row in insights
], use_container_width=True)

st.subheader("Semantic chunks")
st.dataframe([
    {
        "type": row.get("chunk_type"),
        "context": row.get("context"),
        "confidence": row.get("confidence"),
        "source": row.get("source_ref"),
        "content": row.get("content"),
    }
    for row in chunks[:100]
], use_container_width=True)
