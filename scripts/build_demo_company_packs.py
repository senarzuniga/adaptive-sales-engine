#!/usr/bin/env python3
"""Generate the CTA and Ingecart demo packs under public/company-packs."""
from __future__ import annotations

import sys
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
if str(WORKSPACE_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKSPACE_ROOT))

from application.services.company_packs import write_demo_packs


def main() -> None:
    written = write_demo_packs(WORKSPACE_ROOT)
    for path in written:
        print(path)


if __name__ == "__main__":
    main()
