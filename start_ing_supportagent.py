#!/usr/bin/env python3
"""
Launcher rápido para ING_SupportAgent

Ejecuta el Streamlit app creada en `ing_support_agent/app.py` y abre
el navegador en `http://localhost:{port}`. Diseñado para uso local diario.

Uso:
    python start_ing_supportagent.py --port 8501 --open

"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
APP_PATH = ROOT / "ing_support_agent" / "app.py"


def ensure_streamlit_available() -> bool:
    try:
        import streamlit  # type: ignore
        return True
    except Exception:
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Start ING_SupportAgent Streamlit app")
    parser.add_argument("--port", type=int, default=8501, help="Port for Streamlit server")
    parser.add_argument("--open", action="store_true", help="Open the app in the default browser")
    parser.add_argument("--no-wait", action="store_true", help="Don't wait for server to be reachable before opening")
    args = parser.parse_args()

    if not APP_PATH.exists():
        print(f"Error: {APP_PATH} not found. Run this script from the repository root.")
        raise SystemExit(1)

    if not ensure_streamlit_available():
        print("Streamlit no está instalado en el entorno actual.")
        print("Instálalo con:")
        print("    python -m pip install -r requirements_streamlit.txt")
        raise SystemExit(1)

    cmd = [sys.executable, "-m", "streamlit", "run", str(APP_PATH), "--server.port", str(args.port)]

    env = os.environ.copy()

    print("Iniciando ING_SupportAgent...")
    print("Comando:", " ".join(cmd))

    proc = subprocess.Popen(cmd, env=env)

    url = f"http://localhost:{args.port}"

    if args.open:
        if not args.no_wait:
            # Wait a short while for the server to start
            for i in range(20):
                try:
                    webbrowser.open(url)
                    break
                except Exception:
                    time.sleep(0.5)
        else:
            webbrowser.open(url)

    print(f"ING_SupportAgent launching (PID={proc.pid}). Open: {url}")
    try:
        proc.wait()
    except KeyboardInterrupt:
        print("Stopping server...")
        proc.terminate()


if __name__ == "__main__":
    main()
