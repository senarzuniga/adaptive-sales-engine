from __future__ import annotations

from pathlib import Path
import yaml

from ingestion.models.source_config import SourceConfig


class SourceRegistry:
    def __init__(self, config_path: str | Path):
        self.config_path = Path(config_path)
        self.sources: list[SourceConfig] = []

    def load(self) -> list[SourceConfig]:
        raw = yaml.safe_load(self.config_path.read_text(encoding="utf-8")) or {}
        self.sources = [SourceConfig.from_dict(item) for item in raw.get("sources", [])]
        return self.sources

    def get_by_id(self, source_id: str) -> SourceConfig | None:
        return next((s for s in self.sources if s.id == source_id), None)

    def list_active(self) -> list[SourceConfig]:
        return [s for s in self.sources if s.is_active]
