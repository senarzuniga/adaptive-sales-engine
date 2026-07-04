import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from scripts import ingestion_db, review_manager

ENT_ID = '62d142244b09fb3b1bbc8646'

# Build decision mapping
decisions = ingestion_db.fetch_all('review_decisions', limit=5000)
dec_by_candidate = {}
for d in decisions:
    cid = d.get('candidate_id')
    if not cid:
        continue
    prev = dec_by_candidate.get(cid)
    if not prev or d.get('timestamp','') > prev.get('timestamp',''):
        dec_by_candidate[cid] = d

# Gather candidates
candidates = review_manager.list_candidates(enterprise_id=ENT_ID, limit=2000)

print('Total candidates for enterprise', ENT_ID, len(candidates))

# Print examples for each category
promoted_new = []
promoted_update = []
promoted_merge = []
pending = []
rejected = []
blocked = []

for c in candidates:
    cid = c.get('candidate_id')
    d = dec_by_candidate.get(cid)
    action = d.get('review_action') if d else (c.get('review_action') or None)
    if action == 'APPROVE_NEW':
        promoted_new.append((cid, d))
    elif action == 'APPROVE_UPDATE_EXISTING':
        promoted_update.append((cid, d))
    elif action == 'APPROVE_MERGE':
        promoted_merge.append((cid, d))
    elif action == 'REJECT' or action == 'REJECTED':
        rejected.append((cid, d))
    elif action == 'BLOCKED':
        blocked.append((cid, d))
    else:
        pending.append((cid, d))

print('promoted_new:', len(promoted_new))
print('promoted_update:', len(promoted_update))
print('promoted_merge:', len(promoted_merge))
print('pending:', len(pending))
print('rejected:', len(rejected))
print('blocked:', len(blocked))

# Show one example of each where available
if promoted_new:
    cid, d = promoted_new[0]
    print('\nPromoted new example:', cid, '->', d.get('resulting_final_id'))
    prov = review_manager.get_candidate_details(cid)
    print('Provenance file:', prov.get('file_ingestion'))

if promoted_update:
    cid, d = promoted_update[0]
    print('\nPromoted update example:', cid, '->', d.get('resulting_final_id'), 'linked_existing:', d.get('linked_existing_entity_id'))
    prov = review_manager.get_candidate_details(cid)
    print('Provenance file:', prov.get('file_ingestion'))

if pending:
    cid, d = pending[0]
    print('\nPending example:', cid)
    prov = review_manager.get_candidate_details(cid)
    print('Provenance file:', prov.get('file_ingestion'))

if blocked:
    cid, d = blocked[0]
    print('\nBlocked example:', cid, d)

# Quick check that audit view would include the promoted examples by building the same compact rows
from collections import defaultdict
finals = ingestion_db.fetch_all('final_structured_data', limit=2000)
final_by_id = {f.get('id'): f for f in finals}

rows = []
for c in candidates:
    cid = c.get('candidate_id')
    d = dec_by_candidate.get(cid)
    action = d.get('review_action') if d else (c.get('review_action') or None)
    resulting_final = d.get('resulting_final_id') if d else None
    outcome = None
    if action == 'APPROVE_NEW': outcome = 'created_new'
    if action == 'APPROVE_UPDATE_EXISTING': outcome = 'updated_existing'
    if action == 'APPROVE_MERGE': outcome = 'merged_existing'
    row = dict(candidate_id=cid, action=action, final_id=resulting_final, outcome=outcome)
    rows.append(row)

print('\nSample rows (first 10):')
for r in rows[:10]:
    print(r)
