import argparse
import asyncio
from .orchestrator import Orchestrator


def main():
    parser = argparse.ArgumentParser(prog="orchestrator", description="Run AI Orchestrator")
    parser.add_argument("--request", required=False, help="User request to orchestrate", default="Should we submit this proposal?")
    parser.add_argument("--tenant", required=False, help="Tenant/company id", default="ACME")
    args = parser.parse_args()

    orch = Orchestrator()
    res = asyncio.run(orch.execute(args.request, tenant_id=args.tenant))
    print("Orchestration result:")
    print(res)


if __name__ == "__main__":
    main()
