from __future__ import annotations

from typing import Any


class VectorStore:
    """Pluggable vector-store adapter placeholder (Pinecone/Weaviate/etc)."""

    def __init__(self, client: Any | None = None):
        self.client = client

    async def upsert_document(self, doc_id: str, text: str, metadata: dict) -> None:
        # Intentionally kept generic: wire provider-specific SDK here.
        _ = (doc_id, text, metadata)
        return
