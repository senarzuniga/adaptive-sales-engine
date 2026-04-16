# Multi-Agent Document Ingestion Architecture

## Audit of the previous ingestion pipeline

### 1. Extraction Quality — CRITICAL FAILURE
- Single-pass extraction mixed parsing, interpretation, and persistence.
- Text was converted and forwarded with weak semantic segmentation.
- Entity relationships and traceable evidence were not stored as first-class knowledge.

### 2. Data Modeling — REDESIGN REQUIRED
- The prior model stored most document intelligence in `company_documents.extracted_data` plus category-specific inserts.
- This made the content hard to traverse semantically and difficult to reuse for downstream AI reasoning.

### 3. Agent Responsibilities — SPLIT REQUIRED
The redesigned system separates responsibilities into:
1. Document Parser Agent
2. Semantic Chunker Agent
3. Knowledge Extractor Agent
4. Normalizer Agent
5. Storage Router Agent

## New pipeline outputs
- Parsed structure with sections, headings, lists, and tables
- Meaning-based chunks with semantic context and confidence
- Entities, relationships, insights, and data points
- Deduplicated canonical knowledge records
- Document store + relational store + vector-ready chunk storage

## Quality rules
- Reject if no entities are extracted
- Reject if no relationships are detected
- Reject if the document cannot be structurally segmented
- Retry automatically with stricter multi-pass processing before final failure
