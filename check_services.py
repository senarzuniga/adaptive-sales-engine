import urllib.request, time, sys

services = [
    ("Streamlit", "http://localhost:8501"),
    ("Ingestion", "http://localhost:8502"),
    ("Orchestrator", "http://127.0.0.1:8000"),
    ("Frontend", "http://localhost:8080"),
]

ok_all = True
for name, url in services:
    up = False
    last_exc = None
    for i in range(15):
        try:
            r = urllib.request.urlopen(url, timeout=3)
            code = getattr(r, "status", None) or r.getcode()
            print(f"{name}: UP ({code})")
            up = True
            break
        except Exception as e:
            last_exc = e
            time.sleep(1)
    if not up:
        print(f"{name}: DOWN - last error: {last_exc}")
        ok_all = False

sys.exit(0 if ok_all else 2)
