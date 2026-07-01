import argparse
import json
from .service import EHRIService
from .harness import run_all
from .are import AREngine


def main():
    parser = argparse.ArgumentParser(prog="ehri", description="EHRI management CLI")
    sub = parser.add_subparsers(dest="cmd")

    sub.add_parser("init-db", help="Initialize EHRI database (creates files)")

    p_create = sub.add_parser("create-profile", help="Create a profile from JSON file")
    p_create.add_argument("--company", required=True)
    p_create.add_argument("--file", required=True, help="JSON file with profile data")

    p_bench = sub.add_parser("run-benchmark", help="Run benchmark seeding for a company")
    p_bench.add_argument("--company", required=True)

    p_epis = sub.add_parser("compute-epis", help="Compute EPIS for a profile")
    p_epis.add_argument("--company", required=True)
    p_epis.add_argument("--profile", required=True)

    p_get = sub.add_parser("get-profile", help="Get profile")
    p_get.add_argument("--company", required=True)
    p_get.add_argument("--profile", required=True)
    p_get.add_argument("--version", type=int)
    sub.add_parser("run-harness", help="Run internal E2E harness to generate events")

    sub.add_parser("compute-ars", help="Compute ASE Readiness Score (ARS) from captured events")

    sub.add_parser("generate-are-reports", help="Generate ARE reports from events")

    args = parser.parse_args()
    svc = EHRIService()

    if args.cmd == "init-db":
        svc.storage.init_db()
        print("EHRI DB initialized at:", svc.storage.db_path)
    elif args.cmd == "create-profile":
        with open(args.file, "r", encoding="utf-8") as f:
            data = json.load(f)
        profile = svc.create_profile(args.company, data)
        print("Created profile:", profile.profile_id, "version", profile.version)
    elif args.cmd == "run-benchmark":
        b = svc.run_benchmark(args.company)
        print(f"Seeded {len(b)} benchmark samples for {args.company}")
    elif args.cmd == "compute-epis":
        epis = svc.compute_epis(args.company, args.profile)
        print("EPIS:", epis.value)
        print(json.dumps(epis.breakdown, indent=2))
    elif args.cmd == "get-profile":
        p = svc.get_profile(args.company, args.profile, args.version)
        if not p:
            print("Profile not found")
        else:
            print(p.to_json())
    elif args.cmd == "run-harness":
        run_all(svc.storage)
        print("Harness executed: events emitted to storage at", svc.storage.db_path)
    elif args.cmd == "compute-ars":
        engine = AREngine(svc.storage)
        res = engine.compute_ars()
        print("ARS:", res.get("score"))
        print(res)
    elif args.cmd == "generate-are-reports":
        engine = AREngine(svc.storage)
        res = engine.compute_ars()
        engine.generate_reports(ars_result=res)
        print("ARE reports generated in modules/ehri/reports/")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
