from __future__ import annotations

import logging

try:
    from loguru import logger as _logger  # type: ignore
except Exception:  # noqa: BLE001
    logging.basicConfig(level=logging.INFO)
    _logger = logging.getLogger("ingestion")

logger = _logger
