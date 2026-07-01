Enterprise Hourly Rate Intelligence (EHRI)
=======================================

Overview
--------
This module implements a governed Master Data component for hourly rates as described in the ASE command. It provides:

- Data models for `HourlyRateProfile`, `BenchmarkValue` and `EPISScore`.
- A small SQLite-backed storage layer with immutable versioning and approval workflow.
- A placeholder Market Benchmark Engine to seed market reference data (replace with connectors to real sources).
- A lightweight AI Assistant with analysis, anomaly detection and scenario simulation heuristics.
- A simple service layer (`EHRIService`) that ties the pieces together.
- A CLI for basic operations and a unit test demonstrating end-to-end flows.

Where to extend
---------------
- Replace `MarketBenchmarkEngine.update_benchmarks` with connectors to trusted market intelligence sources (reports, salary surveys, procurement data, ERP, CRM).
- Replace `AIAssistant` heuristics with calls to your AI stack (via the Context Router / AI Orchestrator).
- Add API endpoints (FastAPI/Flask) or integrate into the ASE Knowledge Graph and Enterprise Memory.
- Add richer approval workflow (multi-step reviews, audit trails) and RBAC integration.

EPIS (Enterprise Pricing Intelligence Score)
------------------------------------------
EPIS is calculated in `service._compute_epis_heuristic`. The implementation is a simple, extensible heuristic combining:

- Competitiveness (vs market median)
- Profitability (margin proxy)
- Utilization, conversion, elasticity, coverage, trend (placeholders)

The function returns a score in 0..100 together with a breakdown that can be surfaced to executive dashboards.

Quick start
-----------
Initialize the DB and run the example unit test:

```
python -m unittest tests/test_ehri.py
```

CLI examples
------------

```
python -m modules.ehri.cli init-db
python -m modules.ehri.cli run-benchmark --company ACME
python -m modules.ehri.cli create-profile --company ACME --file ./profile.json
python -m modules.ehri.cli compute-epis --company ACME --profile <profile_id>
```

Integration points
------------------
- Knowledge Graph: expose approved profile versions and benchmark evidence.
- AI Orchestrator / Context Router: route profiles and benchmark evidence to agents.
- Quotation Engine / Project Cost Engine / CGO Panel: query the active version when creating quotes.
