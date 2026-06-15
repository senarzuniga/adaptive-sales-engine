#!/usr/bin/env python3
"""
Launcher for the ING_SupportAgent orchestrator HTTP service.

Usage:
    python start_ing_orchestrator.py --port 8000 --open

"""
from __future__ import annotations

import argparse
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SERVICE_MODULE = "ing_support_agent.orchestrator_service:app"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--open", action="store_true")
    args = parser.parse_args()

    cmd = [sys.executable, "-m", "uvicorn", SERVICE_MODULE, "--host", "127.0.0.1", "--port", str(args.port)]
    print("Launching orchestrator:", " ".join(cmd))
    proc = subprocess.Popen(cmd)

    if args.open:
        url = f"http://127.0.0.1:{args.port}"
        # Give the server a few seconds
        time.sleep(1)
        webbrowser.open(url)

    try:
        proc.wait()
    except KeyboardInterrupt:
        proc.terminate()


if __name__ == "__main__":
    main()
