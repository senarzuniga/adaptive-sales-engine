from pathlib import Path
import json

from scripts import ingest_pipeline


def main():
    p = Path('data/test_upload.csv')
    if not p.exists():
        p = Path('seeds/example_ingestion_document.md')
    print('Using', p)
    res = ingest_pipeline.process_file(str(p), enterprise_id=None, uploader='test', upload_context='dry run test', auto_approve=False)
    print(json.dumps({k:v if not isinstance(v, dict) else v for k,v in res.items()}, indent=2, default=str))


if __name__ == '__main__':
    main()
