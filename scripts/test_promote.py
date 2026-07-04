import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from scripts import review_manager, ingestion_db
cands = ingestion_db.fetch_all('candidate_structured_data', limit=20)
if not cands:
    print('no candidates')
    raise SystemExit(1)
cid = cands[0].get('id')
print('promoting candidate', cid)
res = review_manager.promote_candidate(cid, reviewer='tester', review_action='APPROVE_NEW')
print('result', res)
print('final count before/after:')
finals = ingestion_db.fetch_all('final_structured_data', limit=50)
print('final_structured_data count', len(finals))
print(finals[:3])
