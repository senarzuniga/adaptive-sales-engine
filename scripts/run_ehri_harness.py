import os
import sys
# Ensure repo root is on sys.path so `modules` package is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from modules.ehri.storage import Storage
from modules.ehri.harness import run_all
from modules.ehri.are import AREngine

if __name__ == '__main__':
    s = Storage()
    print('Storage DB:', s.db_path)
    res = run_all(s)
    print('Harness populated:', res)
    engine = AREngine(s)
    ars = engine.compute_ars()
    print('ARS result:', ars)
    engine.generate_reports(output_dir='modules/ehri/reports', ars_result=ars)
    print('Reports generated in modules/ehri/reports')
