from __future__ import annotations

from datetime import datetime
from typing import Any


class RawStorage:
    def __init__(self, supabase_client: Any | None):
        self.supabase = supabase_client

    async def save_html(self, source_id: str, source_name: str, url: str, html: str, content_hash: str) -> None:
        if not self.supabase:
            return
        payload = {
            "source_id": source_id,
            "source_name": source_name,
            "url": url,
            "html_content": html[:2_000_000],
            "content_hash": content_hash,
            "captured_at": datetime.utcnow().isoformat(),
        }
        self.supabase.table("ingestion_raw_html").insert(payload).execute()

    async def save_error(self, source_id: str, source_name: str, url: str, error_message: str) -> None:
        if not self.supabase:
            return
        payload = {
            "source_id": source_id,
            "source_name": source_name,
            "url": url,
            "error_message": error_message,
            "captured_at": datetime.utcnow().isoformat(),
        }
        self.supabase.table("ingestion_errors").insert(payload).execute()
