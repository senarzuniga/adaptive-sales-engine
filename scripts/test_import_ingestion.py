import sys, traceback
sys.path.insert(0, r"c:\Users\Inaki Senar\Documents\GitHub\adaptive-sales-engine\ai-factory-v2")
try:
    import ingestion
    print('OK', getattr(ingestion, '__file__', str(ingestion)))
except Exception:
    traceback.print_exc()
