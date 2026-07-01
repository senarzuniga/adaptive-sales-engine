# Orchestration Flow Diagram

```mermaid
flowchart TD
  UR[User Request]
  IA[Intent Analyzer]
  CB[Context Builder]
  ER[Enterprise Memory / Knowledge Hub / Truth Graph]
  AR[Agent Registry]
  DS[Dynamic Agent Selection]
  PE[Parallel Execution (Agents)]
  FE[Fusion Engine]
  FC[Fact Checker]
  QA[Quality Assessor]
  AIL[Auto Improvement Loop]
  ED[Executive Decision]

  UR --> IA --> CB --> DS --> PE --> FE --> FC --> QA
  QA -->|meets thresholds| ED
  QA -->|not met| AIL --> PE
  CB --> ER
  DS --> AR
  PE --> FE

```
