import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from scripts import ingestion_db, review_manager
c = ingestion_db.fetch_all('candidate_structured_data', limit=50)
print('candidates:', len(c))
for x in c:
    print(x.get('id'), x.get('entity_type'), x.get('enterprise_id'))
print('\nreview_list sample:')
for r in review_manager.list_candidates(limit=10):
    print(r.get('candidate_id'), r.get('title'), r.get('upload_batch'), r.get('review_action'))
