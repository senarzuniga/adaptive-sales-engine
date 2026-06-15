import importlib.util, traceback, sys
from pathlib import Path
p = Path(r"c:\Users\Inaki Senar\Documents\GitHub\adaptive-sales-engine\ai-factory-v2\ingestion\agents\scraper_agent.py")
print('Loading', p)
# add ai-factory-v2 and ingestion to sys.path like orchestrator
sys.path.insert(0, str(p.parent.parent.parent))
sys.path.insert(0, str(p.parent.parent))
try:
    spec = importlib.util.spec_from_file_location(p.stem, p)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    print('Loaded module', module)
    print('Module attrs:', [a for a in dir(module) if not a.startswith('_')])
except Exception:
    traceback.print_exc()
