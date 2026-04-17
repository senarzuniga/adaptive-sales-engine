# Commercial Intelligence System Redesign

## 1. System architecture redesign

### Core flow

DOCUMENT → PARSER → SEMANTIC CHUNKER → KNOWLEDGE EXTRACTOR → VALIDATOR → DATABASE → CASCADE RE-ANALYSIS → OPPORTUNITIES → ACTIONS

### Deterministic business rules
- Only sales documents define confirmed sales truth.
- Any offer at 100% success probability is reclassified to sold.
- When document data conflicts with inferred or stale system values, the document prevails.
- Open pipeline excludes opportunities already covered by confirmed sales.

## 2. Data model

### Main tables
- `customers`
- `products`
- `offers`
- `offer_products` for many-to-many offer composition
- `competitors`
- `opportunities`
- `actions`
- `insights`

### Supporting tables
- `company_documents`
- `document_ingestion_runs`
- `document_sections`
- `document_chunks`
- `knowledge_entities`
- `knowledge_relationships`
- `knowledge_insights`
- `knowledge_data_points`

## 3. Agent definitions

### Parser Agent
Extracts raw text and structural sections from uploaded documents.

### Semantic Chunker Agent
Groups content by meaning, not just by lines or pages.

### Knowledge Extractor Agent
Identifies entities, relationships, insights, metrics, competitors, customers, and commercial signals.

### Validator Agent
Checks numeric coherence, status consistency, and source-vs-context conflicts. Low-confidence outputs are reprocessed.

### Storage Router Agent
Sends validated records to relational tables, knowledge tables, and vector-ready chunk storage.

### Cascade Re-Analysis Agent
Whenever new data arrives, regenerates segmentation, opportunity maps, key-account tiers, and prioritized actions.

## 4. Processing pipeline

1. Upload or import new sales, offer, customer, or market data.
2. Parse and structurally segment the document.
3. Extract entities, values, and commercial relationships.
4. Validate numbers, status, and contextual consistency.
5. Persist normalized data into the operational schema.
6. Trigger deterministic commercial intelligence generation.
7. Recompute key account tiers, market segments, opportunities, and actions.
8. Reject outputs if required intelligence modules are missing.

## 5. Example of corrected output

```json
{
  "customer": "Ingecart Spain",
  "accountTier": "A",
  "salesTruth": {
    "confirmedSales": 200000,
    "weightedPipeline": 49200,
    "openPipeline": 60000,
    "documentPrevailed": true
  },
  "competitorAnalysis": [
    {
      "name": "ABB",
      "positioning": "High automation reliability and installed-base trust",
      "pricePositioning": "premium-performance"
    }
  ],
  "opportunities": [
    {
      "title": "Protect Ingecart Spain Spare Parts opportunity",
      "priority": "high",
      "expectedImpact": 49200
    }
  ],
  "actions": [
    {
      "title": "Create cross-sell plan for PackCo",
      "requiredEffort": "medium",
      "expectedImpact": 15000
    }
  ]
}
```
