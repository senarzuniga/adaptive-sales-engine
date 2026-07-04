import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from scripts import ingestion_db, review_manager

ENT_ID = '62d142244b09fb3b1bbc8646'

print('Looking for an existing final_structured_data for enterprise', ENT_ID)
finals = ingestion_db.fetch_all('final_structured_data', limit=200)
final = None
for f in finals:
    if f.get('enterprise_id') == ENT_ID:
        final = f
        break
if not final:
    print('No existing final found; attempting to create one by approving a candidate as new')
    # find any candidate for ENT_ID
    cands = ingestion_db.fetch_all('candidate_structured_data', limit=200)
    cand = next((x for x in cands if x.get('enterprise_id') == ENT_ID), None)
    if not cand:
        print('No candidate available to create final; abort')
        raise SystemExit(1)
    res = review_manager.promote_candidate(cand.get('id'), reviewer='audit_tester', review_action='APPROVE_NEW')
    print('Created new final:', res)
    finals = ingestion_db.fetch_all('final_structured_data', limit=200)
    final = next((f for f in finals if f.get('enterprise_id') == ENT_ID), None)

if not final:
    print('Still no final found; abort')
    raise SystemExit(1)

final_id = final.get('id')
print('Using final id', final_id)

# find a candidate that is not yet promoted
cands = ingestion_db.fetch_all('candidate_structured_data', limit=200)
cand_to_update = None
reviewed = ingestion_db.fetch_all('review_decisions', limit=1000)
reviewed_set = {r.get('candidate_id') for r in reviewed}
for c in cands:
    if c.get('enterprise_id') == ENT_ID and c.get('id') not in reviewed_set:
        cand_to_update = c
        break

if not cand_to_update:
    print('No unreviewed candidate found to update; abort')
    raise SystemExit(0)

cid = cand_to_update.get('id')
print('Promoting candidate', cid, 'as UPDATE_EXISTING into', final_id)
res = review_manager.promote_candidate(cid, reviewer='audit_tester', review_action='APPROVE_UPDATE_EXISTING', linked_existing_entity_id=final_id)
print('Result:', res)

# Show latest decision for this candidate
decisions = ingestion_db.fetch_all('review_decisions', limit=2000)
for d in decisions:
    if d.get('candidate_id') == cid:
        print('Decision row:', d)

# Confirm final_structured_data updated/merged
finals = ingestion_db.fetch_all('final_structured_data', limit=200)
f = next((x for x in finals if x.get('id') == final_id), None)
print('Final record after update:', f)
