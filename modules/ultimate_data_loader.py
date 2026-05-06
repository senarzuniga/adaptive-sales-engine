"""
Ultimate Data Loader – Adaptive Sales Engine
Loads data from local files (CSV, Excel, JSON, TXT) with caching and
a concise summary API.
"""

from __future__ import annotations

import hashlib
import json
import logging
import pickle
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _file_hash(path: Path) -> str:
    """Return a BLAKE2b digest of the file's content (fast, ~4 KB blocks).

    BLAKE2b is used instead of MD5/SHA because it is faster and
    collision-resistant.  This hash is only a cache key – it is never
    used for security purposes.
    """
    h = hashlib.blake2b(digest_size=20)
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(4096), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------


class UltimateDataLoader:
    """
    Professional data-loading system with transparent file-hash caching.

    Parameters
    ----------
    base_path:
        Root of the project.  Defaults to the current working directory.
    cache_ttl:
        Seconds before a cache entry is considered stale.  Defaults to
        3600 (1 h).  Pass 0 to disable caching entirely.
    """

    #: Directories to scan for data files (relative to *base_path*).
    DATA_DIRS: List[str] = [
        "data",
        "data/raw",
        "data/processed",
        "documents",
        "uploads",
        "inputs",
        "knowledge_base",
    ]

    #: File extensions handled by each loader.
    LOADERS: Dict[str, str] = {
        ".csv": "_load_csv",
        ".xlsx": "_load_excel",
        ".xls": "_load_excel",
        ".json": "_load_json",
        ".txt": "_load_text",
    }

    def __init__(
        self,
        base_path: Optional[str] = None,
        cache_ttl: int = 3600,
    ) -> None:
        self.base_path = Path(base_path) if base_path else Path.cwd()
        self.cache_path = self.base_path / "cache"
        self.cache_path.mkdir(parents=True, exist_ok=True)
        self.cache_ttl = cache_ttl
        self.loaded_data: Dict[str, Any] = {}
        self.loading_history: List[Dict[str, Any]] = []

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def load_all_data(self, force_reload: bool = False) -> Dict[str, Any]:
        """
        Scan all configured directories and load every supported file.

        Returns a mapping ``{relative_path: loaded_object}`` where loaded
        objects are ``pd.DataFrame`` for tabular files, ``dict``/``list``
        for JSON, and ``str`` for plain text.
        """
        all_data: Dict[str, Any] = {}

        for data_dir in self.DATA_DIRS:
            dir_path = self.base_path / data_dir
            if not dir_path.exists():
                continue

            for ext, loader_name in self.LOADERS.items():
                for file_path in dir_path.glob(f"**/*{ext}"):
                    rel = str(file_path.relative_to(self.base_path))
                    try:
                        data = self._load_file(
                            file_path, loader_name, force_reload
                        )
                        all_data[rel] = data
                        self._record(rel, success=True)
                        logger.debug("loaded: %s", rel)
                    except Exception as exc:  # noqa: BLE001
                        logger.warning("failed to load %s: %s", rel, exc)
                        self._record(rel, success=False, error=str(exc))

        self.loaded_data = all_data
        return all_data

    def get_data_summary(self) -> Dict[str, Any]:
        """Return a high-level summary of what has been loaded."""
        frames = {
            k: v
            for k, v in self.loaded_data.items()
            if isinstance(v, pd.DataFrame)
        }
        total_rows = sum(len(df) for df in frames.values())
        return {
            "total_sources": len(self.loaded_data),
            "dataframes": len(frames),
            "total_rows": total_rows,
            "loading_history": self.loading_history[-10:],
        }

    def load_single_file(
        self,
        path: Union[str, Path],
        force_reload: bool = False,
    ) -> Any:
        """Load a single file by path, using the cache when possible."""
        file_path = Path(path)
        if not file_path.exists():
            raise FileNotFoundError(file_path)
        ext = file_path.suffix.lower()
        loader_name = self.LOADERS.get(ext)
        if loader_name is None:
            raise ValueError(f"Unsupported file extension: {ext}")
        return self._load_file(file_path, loader_name, force_reload)

    # ------------------------------------------------------------------
    # Internal loaders
    # ------------------------------------------------------------------

    def _load_file(
        self,
        file_path: Path,
        loader_name: str,
        force_reload: bool,
    ) -> Any:
        if self.cache_ttl > 0 and not force_reload:
            cached = self._from_cache(file_path)
            if cached is not None:
                return cached

        loader = getattr(self, loader_name)
        data = loader(file_path)

        if self.cache_ttl > 0:
            self._to_cache(file_path, data)

        return data

    def _load_csv(self, path: Path) -> pd.DataFrame:
        return pd.read_csv(path, encoding="utf-8", on_bad_lines="skip")

    def _load_excel(self, path: Path) -> pd.DataFrame:
        return pd.read_excel(path, sheet_name=0)

    def _load_json(self, path: Path) -> Any:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)

    def _load_text(self, path: Path) -> str:
        return path.read_text(encoding="utf-8", errors="replace")

    # ------------------------------------------------------------------
    # Cache helpers
    # ------------------------------------------------------------------

    def _cache_key(self, file_path: Path) -> Path:
        digest = _file_hash(file_path)
        return self.cache_path / f"{digest}.pkl"

    def _from_cache(self, file_path: Path) -> Optional[Any]:
        cache_file = self._cache_key(file_path)
        if not cache_file.exists():
            return None
        age = time.time() - cache_file.stat().st_mtime
        if age > self.cache_ttl:
            return None
        try:
            with cache_file.open("rb") as fh:
                # pickle is used only for caching DataFrames/objects locally.
                # The cache directory should be writable only by the app user.
                # Treat the cache as a trusted local store – never load cache
                # files received from external sources.
                return pickle.load(fh)  # noqa: S301
        except Exception:  # noqa: BLE001
            return None

    def _to_cache(self, file_path: Path, data: Any) -> None:
        cache_file = self._cache_key(file_path)
        try:
            with cache_file.open("wb") as fh:
                pickle.dump(data, fh, protocol=pickle.HIGHEST_PROTOCOL)
        except Exception as exc:  # noqa: BLE001
            logger.warning("cache write failed for %s: %s", file_path, exc)

    # ------------------------------------------------------------------
    # History
    # ------------------------------------------------------------------

    def _record(
        self,
        rel: str,
        *,
        success: bool,
        error: str = "",
    ) -> None:
        from datetime import datetime

        self.loading_history.append(
            {
                "path": rel,
                "success": success,
                "error": error,
                "ts": datetime.utcnow().isoformat(),
            }
        )


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_data_loader: Optional[UltimateDataLoader] = None


def get_data_loader() -> UltimateDataLoader:
    global _data_loader
    if _data_loader is None:
        _data_loader = UltimateDataLoader()
    return _data_loader
