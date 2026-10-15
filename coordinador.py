"""Alias utilitario para el agente raíz de coordinación."""

from root_coordination_agent import CoordinadorAgent, RootCoordinationAgent

__all__ = ["RootCoordinationAgent", "CoordinadorAgent"]


if __name__ == "__main__":
    import json
    import argparse

    parser = argparse.ArgumentParser(description="Agente coordinador del repositorio.")
    parser.add_argument("--mission", default="Gobernanza del ecosistema", help="Nombre de la misión")
    parser.add_argument("--objective", default="Asegurar coordinación y mejora continua del repositorio", help="Objetivo principal")
    parser.add_argument("--context", default="{}", help="Contexto JSON opcional")
    args = parser.parse_args()

    context = json.loads(args.context) if args.context else {}
    result = RootCoordinationAgent().run(args.mission, args.objective, context=context)
    print(json.dumps(result, ensure_ascii=False, indent=2))
