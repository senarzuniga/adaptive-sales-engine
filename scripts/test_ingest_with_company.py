import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
comp_file = ROOT / 'data' / 'companies.json'
print('companies file exists:', comp_file.exists())
if comp_file.exists():
    comps = json.loads(comp_file.read_text(encoding='utf-8'))
    print('companies count:', len(comps))
    cid = comps[0].get('id')
    print('using id:', cid)
    import sys
    sys.path.insert(0, str(ROOT))
    from scripts import ingest_pipeline
    res = ingest_pipeline.process_file('seeds/example_ingestion_document.md', enterprise_id=cid, uploader='cli', upload_context='with enterprise id test')
    print('ingestion id:', res['ingestion_id'])
else:
    print('no companies file')
