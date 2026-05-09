"""
File parser — converts virtually any uploaded file to a pandas DataFrame.

Extracted from streamlit_app.py so it can be used independently of
Streamlit and tested without a running Streamlit server.
"""
from __future__ import annotations

import io
import ipaddress
import logging
import re
import socket
import zipfile
from typing import Optional
from urllib.parse import urlparse

import pandas as pd

from config import MAX_DATAFRAME_ROWS, OCR_AVAILABLE, DOCX_AVAILABLE, PDF_AVAILABLE

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────
# URL safety
# ──────────────────────────────────────────────────────────────


def is_safe_url(url: str) -> bool:
    """Return True only for http/https URLs pointing to non-private hosts."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False
    hostname = parsed.hostname or ""
    if not hostname:
        return False
    if hostname in ("localhost", "0.0.0.0"):
        return False
    try:
        addr = ipaddress.ip_address(socket.gethostbyname(hostname))
        if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved:
            return False
    except Exception:
        return False
    return True


# ──────────────────────────────────────────────────────────────
# File parsing
# ──────────────────────────────────────────────────────────────


def parse_file_to_df(file_name: str, file_bytes: bytes) -> Optional[pd.DataFrame]:
    """Convert virtually ANY uploaded file to a pandas DataFrame."""
    fname = file_name.lower()
    df: Optional[pd.DataFrame] = None
    try:
        if fname.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_bytes))
        elif fname.endswith((".xls", ".xlsx")):
            df = pd.read_excel(io.BytesIO(file_bytes))
        elif fname.endswith(".tsv"):
            df = pd.read_csv(io.BytesIO(file_bytes), sep="\t")
        elif fname.endswith(".parquet"):
            df = pd.read_parquet(io.BytesIO(file_bytes))
        elif fname.endswith(".feather"):
            df = pd.read_feather(io.BytesIO(file_bytes))
        elif fname.endswith(".json"):
            df = pd.read_json(io.BytesIO(file_bytes))
        elif fname.endswith(".jsonl"):
            df = pd.read_json(io.BytesIO(file_bytes), lines=True)
        elif fname.endswith(".txt"):
            text = file_bytes.decode("utf-8", errors="replace")
            lines = text.splitlines()
            df = pd.DataFrame({"linea": lines, "longitud": [len(ln) for ln in lines]})
        elif fname.endswith(".md"):
            text = file_bytes.decode("utf-8", errors="replace")
            df = pd.DataFrame({"linea_markdown": text.splitlines()})
        elif fname.endswith((".html", ".xml")):
            text = file_bytes.decode("utf-8", errors="replace")
            df = pd.DataFrame({"linea": text.splitlines()})
        elif fname.endswith(".pdf"):
            if PDF_AVAILABLE:
                from pypdf import PdfReader
                reader = PdfReader(io.BytesIO(file_bytes))
                texts = [page.extract_text() or "" for page in reader.pages]
                df = pd.DataFrame({"pagina": range(1, len(texts) + 1), "texto": texts})
            else:
                df = pd.DataFrame({"error": ["pypdf not installed — pip install pypdf"]})
        elif fname.endswith(".docx"):
            if DOCX_AVAILABLE:
                from docx import Document
                doc = Document(io.BytesIO(file_bytes))
                paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
                df = pd.DataFrame({"parrafo": paragraphs})
            else:
                df = pd.DataFrame({"error": ["python-docx not installed"]})
        elif fname.endswith((".png", ".jpg", ".jpeg", ".bmp", ".tiff")):
            if OCR_AVAILABLE:
                import pytesseract
                from PIL import Image
                image = Image.open(io.BytesIO(file_bytes))
                text = pytesseract.image_to_string(image)
                df = pd.DataFrame({"texto_extraido": text.splitlines()})
            else:
                df = pd.DataFrame({
                    "info": ["Imagen recibida (OCR no disponible)"],
                    "nombre_archivo": [file_name],
                })
        elif fname.endswith(".zip"):
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
                all_dfs = []
                for inner_name in z.namelist():
                    if inner_name.endswith("/"):
                        continue
                    with z.open(inner_name) as inner_file:
                        inner_bytes = inner_file.read()
                        inner_df = parse_file_to_df(inner_name, inner_bytes)
                        if inner_df is not None:
                            inner_df["archivo_origen"] = inner_name
                            all_dfs.append(inner_df)
                if all_dfs:
                    df = pd.concat(all_dfs, ignore_index=True)
        elif fname.endswith((".db", ".sqlite")):
            import sqlite3
            import tempfile
            import os
            tmp_path = None
            try:
                with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
                    tmp.write(file_bytes)
                    tmp_path = tmp.name
                conn = sqlite3.connect(tmp_path)
                tables = pd.read_sql(
                    "SELECT name FROM sqlite_master WHERE type='table'", conn
                )
                if not tables.empty:
                    first_table = str(tables.iloc[0]["name"])
                    if not re.match(r'^[A-Za-z_][A-Za-z0-9_]*$', first_table):
                        raise ValueError(f"Unsafe table name: {first_table!r}")
                    df = pd.read_sql(f'SELECT * FROM "{first_table}"', conn)
                    df["_tabla_origen"] = first_table
                conn.close()
            finally:
                if tmp_path and os.path.exists(tmp_path):
                    os.unlink(tmp_path)
    except Exception as exc:
        logger.warning("parse_file_to_df error for %s: %s", file_name, exc)
        df = pd.DataFrame({"error": [str(exc)], "archivo": [file_name]})

    if df is not None and len(df) > MAX_DATAFRAME_ROWS:
        logger.info("File %s truncated from %d to %d rows", file_name, len(df), MAX_DATAFRAME_ROWS)
        df = df.head(MAX_DATAFRAME_ROWS)
    return df
