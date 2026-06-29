# ING_SupportAgent

Lightweight orchestration helpers and quick UI for the Adaptive Sales Engine.

Overview:
- `app.py`: Streamlit-based minimal UI to run the `MaximumOrchestrator` and inspect results.
- `orchestrator_service.py`: FastAPI service that exposes endpoints to execute and monitor agents.
- `start_ing_supportagent.py`: (root) small launcher that starts the Streamlit UI.
- `start_ing_orchestrator.py`: (root) small launcher that starts the HTTP orchestrator.

Usage (recommended):
1. Start the orchestrator HTTP service:
   ```bash
   python start_ing_orchestrator.py --port 8000 --open
   ```

2. Start the Streamlit UI:
   ```bash
   python start_ing_supportagent.py --port 8501 --open
   ```

Notes:
- The code reuses the repository `orchestrator.py` and agents under `/agents` and `/ai-factory-v2`.
- Supabase interactions are optional; when not configured the app falls back to local session storage.
- For autonomous periodic runs, set `ING_SUPPORT_SCHEDULE_SECONDS` in the environment before launching the orchestrator.
