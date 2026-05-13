"""
fix_connections.py — Verifica y repara conexiones entre sistemas del ecosistema ACS
====================================================================================
Comprueba: Supabase, servicios locales, archivos de configuración y variables de entorno.

Uso:
    python scripts/fix_connections.py
    python scripts/fix_connections.py --fix   # intenta reparar problemas detectados
"""
from __future__ import annotations

import argparse
import os
import shutil
import sys
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
RESET  = "\033[0m"
BOLD   = "\033[1m"


def _ok(msg: str) -> str:
    return f"{GREEN}✅ {msg}{RESET}"


def _fail(msg: str) -> str:
    return f"{RED}❌ {msg}{RESET}"


def _warn(msg: str) -> str:
    return f"{YELLOW}⚠️  {msg}{RESET}"


def check_env_file(fix: bool = False) -> bool:
    env_file = ROOT / ".env"
    example  = ROOT / ".env.example"
    if env_file.exists():
        print(_ok(".env file found"))
        return True
    print(_fail(".env not found"))
    if fix and example.exists():
        shutil.copy(example, env_file)
        print(_warn("  → .env created from .env.example. Please fill in your credentials."))
    return False


def check_env_vars() -> dict:
    required = ["SUPABASE_URL", "SUPABASE_KEY"]
    optional = ["SUPABASE_SERVICE_ROLE_KEY", "GMAIL_ADDRESS", "GMAIL_APP_PASSWORD"]

    # Try loading .env
    try:
        from dotenv import load_dotenv
        load_dotenv(ROOT / ".env", override=False)
        load_dotenv(ROOT / ".env.local", override=True)
    except ImportError:
        pass

    results = {}
    print("\n  Required env vars:")
    for var in required:
        val = os.getenv(var, "")
        ok = bool(val)
        results[var] = ok
        print(f"    {_ok(var) if ok else _fail(var + ' (NOT SET)')}")

    print("\n  Optional env vars:")
    for var in optional:
        val = os.getenv(var, "")
        ok = bool(val)
        results[var] = ok
        print(f"    {_ok(var) if ok else _warn(var + ' (not set)')}")

    return results


def check_supabase_connection() -> bool:
    try:
        from dotenv import load_dotenv
        load_dotenv(ROOT / ".env", override=False)
    except ImportError:
        pass

    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_KEY", "")

    if not url or not key:
        print(_warn("Supabase — skipped (credentials not configured, running in demo mode)"))
        return True  # Not a failure — demo mode is valid

    try:
        from infrastructure.supabase_client import get_supabase
        sb = get_supabase()
        if sb is None:
            print(_warn("Supabase — not configured (demo mode)"))
            return True
        # Test a simple query
        sb.table("profiles").select("id").limit(1).execute()
        print(_ok("Supabase connection OK"))
        return True
    except Exception as exc:
        print(_fail(f"Supabase connection FAILED: {exc}"))
        return False


def check_service(name: str, url: str, required: bool = False) -> bool:
    try:
        req = urllib.request.Request(url, method="HEAD")
        urllib.request.urlopen(req, timeout=2)
        print(_ok(f"{name} ({url})"))
        return True
    except Exception:
        if required:
            print(_fail(f"{name} ({url}) — NOT RUNNING"))
        else:
            print(_warn(f"{name} ({url}) — not running (optional)"))
        return not required


def check_outputs_dir(fix: bool = False) -> bool:
    d = ROOT / "outputs"
    if d.exists():
        print(_ok("outputs/ directory exists"))
        return True
    print(_warn("outputs/ directory missing"))
    if fix:
        d.mkdir(parents=True, exist_ok=True)
        print(_warn("  → outputs/ created"))
    return True


def check_data_dir(fix: bool = False) -> bool:
    d = ROOT / "data"
    if d.exists():
        print(_ok("data/ directory exists"))
        return True
    print(_warn("data/ directory missing"))
    if fix:
        d.mkdir(parents=True, exist_ok=True)
        print(_warn("  → data/ created"))
    return True


def check_python_deps() -> bool:
    required = ["streamlit", "pandas", "pydantic"]
    missing = []
    for pkg in required:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)
    if not missing:
        print(_ok("Core Python dependencies present"))
        return True
    print(_fail(f"Missing Python packages: {', '.join(missing)}"))
    print(_warn("  → Run: pip install -r requirements.txt"))
    return False


def check_orchestrator() -> bool:
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location("orchestrator", ROOT / "orchestrator.py")
        if spec and spec.loader:
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)  # type: ignore[union-attr]
            if hasattr(module, "get_max_orchestrator"):
                orch = module.get_max_orchestrator()
                n = len(orch.agents)
                print(_ok(f"MaximumOrchestrator importable — {n} agentes cargados"))
                return True
    except Exception as exc:
        print(_fail(f"Orchestrator import failed: {exc}"))
        return False
    print(_fail("Orchestrator: get_max_orchestrator not found"))
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description="ACS Connection Checker & Fixer")
    parser.add_argument("--fix", action="store_true", help="Attempt to fix detected issues")
    args = parser.parse_args()

    print(f"\n{BOLD}{'='*60}")
    print("  ACS CONNECTION VERIFIER")
    print(f"{'='*60}{RESET}")

    failures = 0

    print(f"\n{BOLD}[1/7] Archivos de configuración{RESET}")
    if not check_env_file(fix=args.fix):
        failures += 1

    print(f"\n{BOLD}[2/7] Variables de entorno{RESET}")
    env_results = check_env_vars()

    print(f"\n{BOLD}[3/7] Conexión Supabase{RESET}")
    if not check_supabase_connection():
        failures += 1

    print(f"\n{BOLD}[4/7] Servicios locales{RESET}")
    check_service("Streamlit App",    "http://localhost:8501")
    check_service("Next.js Frontend", "http://localhost:8080")
    check_service("FastAPI Backend",  "http://localhost:8000")
    check_service("Ingestion Monitor","http://localhost:8502")

    print(f"\n{BOLD}[5/7] Directorios de datos{RESET}")
    check_outputs_dir(fix=args.fix)
    check_data_dir(fix=args.fix)

    print(f"\n{BOLD}[6/7] Dependencias Python{RESET}")
    if not check_python_deps():
        failures += 1

    print(f"\n{BOLD}[7/7] Orquestador ACS{RESET}")
    if not check_orchestrator():
        failures += 1

    print(f"\n{BOLD}{'='*60}")
    if failures == 0:
        print(f"{GREEN}  ✅ TODAS LAS CONEXIONES OK{RESET}")
    else:
        print(f"{RED}  ❌ {failures} PROBLEMA(S) DETECTADO(S){RESET}")
        if not args.fix:
            print(f"{YELLOW}  → Ejecuta con --fix para intentar reparación automática{RESET}")
    print(f"{BOLD}{'='*60}{RESET}\n")

    sys.exit(0 if failures == 0 else 1)


if __name__ == "__main__":
    main()
