export type SectionKind = 'heading' | 'paragraph' | 'list' | 'table';
export type SemanticChunkType = 'concept' | 'fact' | 'process' | 'insight';
export type EntityType = 'organization' | 'person' | 'product' | 'metric' | 'location' | 'document' | 'concept' | 'contact' | 'unknown';

export interface IngestionDocumentContext {
  docId: string;
  companyId: string;
  category: string;
  fileName: string;
  mimeType?: string;
  textContent: string;
  companyContext?: string;
  strictMode?: boolean;
  aiKey?: string;
}

export interface ParsedSection {
  id: string;
  heading: string;
  level: number;
  kind: SectionKind;
  content: string;
  semanticContext: string;
  order: number;
}

export interface SemanticChunk {
  id: string;
  sectionId: string;
  documentId: string;
  type: SemanticChunkType;
  content: string;
  context: string;
  semanticContext: string;
  sourceRef: string;
  confidence: number;
  embedding: string;
}

export interface KnowledgeEntity {
  id: string;
  canonicalName: string;
  entityType: EntityType;
  aliases: string[];
  confidence: number;
  sourceChunkId: string;
  sourceSectionRef: string;
  semanticContext: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeRelationship {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relationType: string;
  evidence: string;
  confidence: number;
  sourceChunkId: string;
  semanticContext: string;
}

export interface KnowledgeInsight {
  id: string;
  insightType: 'claim' | 'risk' | 'opportunity' | 'procedure';
  summary: string;
  evidence: string;
  confidence: number;
  sourceChunkId: string;
  semanticContext: string;
}

export interface KnowledgeDataPoint {
  id: string;
  metricName: string;
  metricValueText: string;
  metricValueNum: number | null;
  unit: string;
  confidence: number;
  sourceChunkId: string;
  semanticContext: string;
}

export interface ParsedDocument {
  docId: string;
  rawText: string;
  cleanedText: string;
  sections: ParsedSection[];
}

export interface ExtractedKnowledge {
  entities: KnowledgeEntity[];
  relationships: KnowledgeRelationship[];
  insights: KnowledgeInsight[];
  dataPoints: KnowledgeDataPoint[];
}

export interface QualityGateResult {
  accepted: boolean;
  score: number;
  issues: string[];
  strictMode: boolean;
}

export interface IngestionPipelineResult {
  parsed: ParsedDocument;
  chunks: SemanticChunk[];
  knowledge: ExtractedKnowledge;
  qualityGate: QualityGateResult;
  summary: string;
  agentAudit: {
    extractionQuality: 'critical-failure' | 'improved';
    dataModeling: 'redesign-required' | 'structured';
    agentResponsibilities: 'split-required' | 'specialized';
    findings: string[];
  };
}

export const AGENT_DEFINITIONS = {
  parser: {
    id: 'document-parser-agent',
    name: 'Document Parser Agent',
    responsibilities: ['load document text', 'clean and normalize content', 'detect headings, tables, lists, and sections'],
  },
  chunker: {
    id: 'semantic-chunker-agent',
    name: 'Semantic Chunker Agent',
    responsibilities: ['chunk by meaning, not by size', 'classify concepts, facts, and procedures', 'preserve section context'],
  },
  extractor: {
    id: 'knowledge-extractor-agent',
    name: 'Knowledge Extractor Agent',
    responsibilities: ['extract entities, relationships, metrics, and claims', 'run interpretation pass', 'produce traceable evidence'],
  },
  normalizer: {
    id: 'normalizer-agent',
    name: 'Normalizer Agent',
    responsibilities: ['deduplicate entities', 'normalize naming', 'link aliases and related concepts'],
  },
  router: {
    id: 'storage-router-agent',
    name: 'Storage Router Agent',
    responsibilities: ['route document store data', 'route relational knowledge data', 'route vector-ready chunk data'],
  },
} as const;

const nowIso = () => new Date().toISOString();
const cleanText = (value: unknown) => String(value ?? '').replace(/\u0000/g, '').trim();
const normalizeKey = (value: string) => cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const unique = <T,>(items: T[]) => [...new Set(items)];

const isHeadingLine = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^#{1,6}\s+/.test(trimmed)) return true;
  if (/^[A-Z][A-Z0-9\s/&()-]{3,80}$/.test(trimmed)) return true;
  if (/^\d+(\.\d+)*\s+[A-Z]/.test(trimmed)) return true;
  return trimmed.endsWith(':') && trimmed.length < 90;
};

const classifySectionKind = (content: string): SectionKind => {
  const trimmed = content.trim();
  if (!trimmed) return 'paragraph';
  if (/\|.+\|/.test(trimmed) || /\t/.test(trimmed)) return 'table';
  if (/^(?:[-*•]|\d+[.)])\s+/m.test(trimmed)) return 'list';
  return 'paragraph';
};

const classifyChunkType = (content: string): SemanticChunkType => {
  const lower = content.toLowerCase();
  if (/\b(step|procedure|process|workflow|how to|follow-up|next action|must|should)\b/.test(lower)) return 'process';
  if (/[$€£¥%]|\b\d{4}\b|\b\d+(?:[.,]\d+)?\b/.test(content)) return 'fact';
  if (/\b(is|means|refers to|defined as|strategy|objective|vision|problem)\b/.test(lower)) return 'concept';
  return 'insight';
};

const confidenceForText = (content: string, bias = 0.62) => {
  const signals = [
    /[$€£¥%]/.test(content),
    /\b[A-Z][a-z]+\s[A-Z][a-z]+/.test(content),
    /\b(step|process|workflow|target|revenue|margin|customer|region)\b/i.test(content),
  ].filter(Boolean).length;
  return Math.min(0.98, Number((bias + signals * 0.09).toFixed(2)));
};

const makeId = (...parts: string[]) => unique(parts.map(normalizeKey).filter(Boolean)).join('-').slice(0, 120) || 'item';

const buildLightweightEmbedding = (text: string, dims = 16) => {
  const vector = new Array<number>(dims).fill(0);
  const tokens = cleanText(text).toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2);
  tokens.forEach((token, index) => {
    const bucket = Array.from(token).reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % dims;
    vector[bucket] += 1 + ((index % 3) * 0.1);
  });
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  const normalized = vector.map((value) => Number((value / magnitude).toFixed(6)));
  return `[${normalized.join(',')}]`;
};

export function normalizeOpportunityStatus(value: unknown): 'won' | 'lost' | 'neglected' | 'open' {
  const status = cleanText(value).toLowerCase();
  if (!status) return 'open';

  if (['won', 'ganado', 'sold', 'vendido', 'closed won', 'closedwon', 'booked', 'order received', 'pedido recibido', 'po received', 'awarded', 'facturado', 'invoiced'].some((token) => status.includes(token))) return 'won';
  if (['lost', 'perdido', 'closed lost', 'closedlost', 'cancel', 'cancelled', 'canceled', 'rejected', 'declined', 'no bid'].some((token) => status.includes(token))) return 'lost';
  if (['desatendido', 'desatendida', 'neglected', 'unattended', 'stalled', 'abandoned', 'sin seguimiento', 'sin atención', 'no follow'].some((token) => status.includes(token))) return 'neglected';
  return 'open';
}

export function parseFlexibleNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  let raw = cleanText(value);
  if (!raw) return 0;

  const negative = (raw.includes('(') && raw.includes(')')) || raw.startsWith('-');
  raw = raw
    .replace(/[()]/g, '')
    .replace(/^[+-]/, '')
    .replace(/\s+/g, '')
    .replace(/[€$£¥]/g, '')
    .replace(/%/g, '');

  const commaCount = (raw.match(/,/g) || []).length;
  const dotCount = (raw.match(/\./g) || []).length;

  if (commaCount > 0 && dotCount > 0) {
    raw = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  } else if (commaCount > 1) {
    raw = raw.replace(/,/g, '');
  } else if (dotCount > 1) {
    raw = raw.replace(/\./g, '');
  } else if (commaCount === 1) {
    const [left, right] = raw.split(',');
    raw = left !== '0' && right?.length === 3 ? `${left}${right}` : `${left}.${right ?? ''}`;
  } else if (dotCount === 1) {
    const [left, right] = raw.split('.');
    if (left !== '0' && right?.length === 3) raw = `${left}${right}`;
  }

  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? (negative ? -parsed : parsed) : 0;
}

export const DocumentParserAgent = {
  ...AGENT_DEFINITIONS.parser,
  run(context: IngestionDocumentContext): ParsedDocument {
    const cleaned = context.textContent
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, '  ')
      .replace(/[ ]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const lines = cleaned.split('\n');
    const sections: ParsedSection[] = [];
    let currentHeading = 'Document Overview';
    let currentLevel = 1;
    let buffer: string[] = [];
    let order = 0;

    const flushSection = () => {
      const content = buffer.join('\n').trim();
      if (!content) return;
      order += 1;
      sections.push({
        id: `${context.docId}-sec-${order}`,
        heading: currentHeading,
        level: currentLevel,
        kind: classifySectionKind(content),
        content,
        semanticContext: `${context.category} • ${currentHeading}`,
        order,
      });
      buffer = [];
    };

    lines.forEach((line) => {
      if (isHeadingLine(line)) {
        flushSection();
        currentHeading = line.replace(/^#{1,6}\s+/, '').replace(/:$/, '').trim();
        currentLevel = (line.match(/^#+/)?.[0].length || 1);
      } else {
        buffer.push(line);
      }
    });

    flushSection();

    if (sections.length === 0 && cleaned) {
      sections.push({
        id: `${context.docId}-sec-1`,
        heading: 'Document Overview',
        level: 1,
        kind: classifySectionKind(cleaned),
        content: cleaned,
        semanticContext: `${context.category} • Document Overview`,
        order: 1,
      });
    }

    return {
      docId: context.docId,
      rawText: context.textContent,
      cleanedText: cleaned,
      sections,
    };
  },
};

export const SemanticChunkerAgent = {
  ...AGENT_DEFINITIONS.chunker,
  run(parsed: ParsedDocument): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];

    parsed.sections.forEach((section) => {
      const blocks = section.kind === 'list'
        ? section.content.split(/\n(?=(?:[-*•]|\d+[.)])\s+)/)
        : section.kind === 'table'
          ? section.content.split(/\n/)
          : section.content.split(/\n\s*\n/);

      blocks
        .map((block) => block.trim())
        .filter(Boolean)
        .forEach((block, index) => {
          const chunkId = `${section.id}-chunk-${index + 1}`;
          chunks.push({
            id: chunkId,
            sectionId: section.id,
            documentId: parsed.docId,
            type: classifyChunkType(block),
            content: block,
            context: section.heading,
            semanticContext: `${section.semanticContext} • ${classifyChunkType(block)}`,
            sourceRef: `${section.heading} > ${index + 1}`,
            confidence: confidenceForText(block),
            embedding: buildLightweightEmbedding(block),
          });
        });
    });

    return chunks;
  },
};

const detectEntityType = (name: string, chunk: SemanticChunk): EntityType => {
  const lower = name.toLowerCase();
  if (/[@]/.test(name)) return 'contact';
  if (/\b(sl|sa|inc|corp|llc|gmbh|ltd|company)\b/i.test(name)) return 'organization';
  if (/\b(spain|france|germany|italy|latam|usa|europe|asia)\b/i.test(name)) return 'location';
  if (/\b(revenue|margin|pipeline|probability|ebitda|growth)\b/i.test(name)) return 'metric';
  if (chunk.type === 'process') return 'concept';
  if (/\b(product|service|platform|module|package)\b/i.test(lower)) return 'product';
  if (/^[A-Z][a-z]+\s[A-Z][a-z]+/.test(name)) return 'person';
  return 'organization';
};

const extractEntityNames = (text: string) => {
  const names = new Set<string>();
  const emailMatches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  emailMatches.forEach((email) => names.add(email));

  const capitalized = text.match(/\b[A-Z][A-Za-z0-9&/-]+(?:\s+[A-Z][A-Za-z0-9&/-]+){0,3}\b/g) || [];
  capitalized.forEach((name) => {
    if (name.length > 2 && !/^The$|^And$|^For$|^With$/.test(name)) names.add(name.trim());
  });

  const keywordMatches = text.match(/\b(?:revenue|margin|pipeline|probability|contract|workflow|customer|region|product|strategy|process)\b/gi) || [];
  keywordMatches.forEach((name) => names.add(name));

  return [...names];
};

const extractDataPoints = (chunk: SemanticChunk): KnowledgeDataPoint[] => {
  const dataPoints: KnowledgeDataPoint[] = [];
  const regex = /([$€£¥]?\s?-?\d[\d.,]*(?:\s?[MBKmbk])?|\d+(?:\.\d+)?%)/g;
  const matches = chunk.content.match(regex) || [];

  matches.forEach((value, index) => {
    const metricName = /%/.test(value) ? 'percentage' : 'amount';
    const unit = /%/.test(value) ? '%' : /[MBKmbk]/.test(value) ? 'scaled_currency' : 'currency';
    dataPoints.push({
      id: `${chunk.id}-dp-${index + 1}`,
      metricName,
      metricValueText: value,
      metricValueNum: parseFlexibleNumber(value),
      unit,
      confidence: confidenceForText(value, 0.74),
      sourceChunkId: chunk.id,
      semanticContext: chunk.semanticContext,
    });
  });

  return dataPoints;
};

const buildLocalKnowledge = (chunks: SemanticChunk[]): ExtractedKnowledge => {
  const entities: KnowledgeEntity[] = [];
  const relationships: KnowledgeRelationship[] = [];
  const insights: KnowledgeInsight[] = [];
  const dataPoints: KnowledgeDataPoint[] = [];

  chunks.forEach((chunk, chunkIndex) => {
    const entityNames = extractEntityNames(chunk.content);
    const entityIds: string[] = [];

    entityNames.forEach((name, index) => {
      const canonicalName = cleanText(name);
      const entityId = makeId('entity', canonicalName, `${chunkIndex}`, `${index}`);
      entityIds.push(entityId);
      entities.push({
        id: entityId,
        canonicalName,
        entityType: detectEntityType(canonicalName, chunk),
        aliases: [canonicalName],
        confidence: confidenceForText(chunk.content, 0.66),
        sourceChunkId: chunk.id,
        sourceSectionRef: chunk.sourceRef,
        semanticContext: chunk.semanticContext,
      });
    });

    dataPoints.push(...extractDataPoints(chunk));

    const sentences = chunk.content.split(/(?<=[.!?])\s+/).filter(Boolean);
    const evidence = sentences[0] || chunk.content;
    insights.push({
      id: `${chunk.id}-insight`,
      insightType: chunk.type === 'process' ? 'procedure' : chunk.type === 'fact' ? 'claim' : 'opportunity',
      summary: evidence.slice(0, 240),
      evidence,
      confidence: chunk.confidence,
      sourceChunkId: chunk.id,
      semanticContext: chunk.semanticContext,
    });

    for (let i = 0; i < entityIds.length - 1; i += 1) {
      relationships.push({
        id: `${chunk.id}-rel-${i + 1}`,
        fromEntityId: entityIds[i],
        toEntityId: entityIds[i + 1],
        relationType: chunk.type === 'process' ? 'part_of_process' : 'associated_with',
        evidence: evidence.slice(0, 240),
        confidence: confidenceForText(evidence, 0.64),
        sourceChunkId: chunk.id,
        semanticContext: chunk.semanticContext,
      });
    }
  });

  return { entities, relationships, insights, dataPoints };
};

const dedupeKnowledge = (knowledge: ExtractedKnowledge): ExtractedKnowledge => {
  const entityMap = new Map<string, KnowledgeEntity>();
  const entityIdMap = new Map<string, string>();

  knowledge.entities.forEach((entity) => {
    const key = makeId(entity.entityType, entity.canonicalName);
    const existing = entityMap.get(key);

    if (!existing) {
      entityMap.set(key, { ...entity, id: key, aliases: unique(entity.aliases) });
    } else {
      existing.aliases = unique([...existing.aliases, ...entity.aliases, entity.canonicalName]);
      existing.confidence = Math.max(existing.confidence, entity.confidence);
    }

    entityIdMap.set(entity.id, key);
  });

  const relSeen = new Set<string>();
  const relationships = knowledge.relationships
    .map((relationship) => ({
      ...relationship,
      fromEntityId: entityIdMap.get(relationship.fromEntityId) || relationship.fromEntityId,
      toEntityId: entityIdMap.get(relationship.toEntityId) || relationship.toEntityId,
    }))
    .filter((relationship) => relationship.fromEntityId !== relationship.toEntityId)
    .filter((relationship) => {
      const key = `${relationship.fromEntityId}|${relationship.relationType}|${relationship.toEntityId}`;
      if (relSeen.has(key)) return false;
      relSeen.add(key);
      return true;
    });

  const insightSeen = new Set<string>();
  const insights = knowledge.insights.filter((insight) => {
    const key = normalizeKey(insight.summary);
    if (insightSeen.has(key)) return false;
    insightSeen.add(key);
    return true;
  });

  const dataPointSeen = new Set<string>();
  const dataPoints = knowledge.dataPoints.filter((dataPoint) => {
    const key = `${dataPoint.metricName}|${dataPoint.metricValueText}|${dataPoint.sourceChunkId}`;
    if (dataPointSeen.has(key)) return false;
    dataPointSeen.add(key);
    return true;
  });

  return {
    entities: [...entityMap.values()],
    relationships,
    insights,
    dataPoints,
  };
};

const applyQualityGate = (parsed: ParsedDocument, chunks: SemanticChunk[], knowledge: ExtractedKnowledge, strictMode = false): QualityGateResult => {
  const issues: string[] = [];
  if (parsed.sections.length === 0 || chunks.length === 0) issues.push('Document is not structurally segmented.');
  if (knowledge.entities.length === 0) issues.push('No entities extracted.');
  if (knowledge.relationships.length === 0) issues.push('No relationships detected.');
  if (knowledge.insights.length === 0) issues.push('No reusable insights captured.');

  const baseScore = Math.min(1, (
    (parsed.sections.length > 0 ? 0.2 : 0) +
    Math.min(chunks.length / 12, 0.2) +
    Math.min(knowledge.entities.length / 10, 0.25) +
    Math.min(knowledge.relationships.length / 8, 0.2) +
    Math.min(knowledge.dataPoints.length / 8, 0.15)
  ));

  return {
    accepted: issues.length === 0,
    score: Number(baseScore.toFixed(2)),
    issues,
    strictMode,
  };
};

const maybeEnrichWithAi = async (context: IngestionDocumentContext, chunks: SemanticChunk[]): Promise<Partial<ExtractedKnowledge> | null> => {
  if (!context.aiKey || chunks.length === 0) return null;

  const payload = chunks.slice(0, context.strictMode ? 18 : 12).map((chunk) => ({
    id: chunk.id,
    type: chunk.type,
    context: chunk.context,
    content: chunk.content,
  }));

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${context.aiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a knowledge extraction specialist. Return JSON only. Extract traceable entities, relationships, insights, and data_points from the provided semantic chunks. Preserve evidence and use confidence values from 0 to 1.',
          },
          {
            role: 'user',
            content: JSON.stringify({ companyContext: context.companyContext, category: context.category, strictMode: !!context.strictMode, chunks: payload }),
          },
        ],
      }),
    });

    if (!response.ok) return null;
    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);

    const entities: KnowledgeEntity[] = (parsed.entities || []).map((entity: any, index: number) => ({
      id: makeId('ai', entity.name || entity.canonicalName || `${index}`),
      canonicalName: cleanText(entity.name || entity.canonicalName || `Entity ${index + 1}`),
      entityType: entity.entityType || 'unknown',
      aliases: unique((entity.aliases || []).concat(entity.name || entity.canonicalName || [])),
      confidence: typeof entity.confidence === 'number' ? entity.confidence : 0.72,
      sourceChunkId: entity.sourceChunkId || payload[0]?.id || 'unknown',
      sourceSectionRef: entity.sourceSectionRef || payload[0]?.context || 'document',
      semanticContext: entity.semanticContext || payload[0]?.context || context.category,
      metadata: entity.metadata || {},
    }));

    const relationships: KnowledgeRelationship[] = (parsed.relationships || []).map((relationship: any, index: number) => ({
      id: makeId('ai-rel', `${index}`, relationship.from, relationship.to),
      fromEntityId: makeId('ai', relationship.from || `from-${index}`),
      toEntityId: makeId('ai', relationship.to || `to-${index}`),
      relationType: cleanText(relationship.relationType || relationship.type || 'related_to') || 'related_to',
      evidence: cleanText(relationship.evidence || ''),
      confidence: typeof relationship.confidence === 'number' ? relationship.confidence : 0.7,
      sourceChunkId: relationship.sourceChunkId || payload[0]?.id || 'unknown',
      semanticContext: relationship.semanticContext || payload[0]?.context || context.category,
    }));

    const insights: KnowledgeInsight[] = (parsed.insights || []).map((insight: any, index: number) => ({
      id: makeId('ai-insight', `${index}`, insight.summary || insight.title || `${index}`),
      insightType: insight.insightType || 'claim',
      summary: cleanText(insight.summary || insight.title || `Insight ${index + 1}`),
      evidence: cleanText(insight.evidence || insight.summary || ''),
      confidence: typeof insight.confidence === 'number' ? insight.confidence : 0.74,
      sourceChunkId: insight.sourceChunkId || payload[0]?.id || 'unknown',
      semanticContext: insight.semanticContext || payload[0]?.context || context.category,
    }));

    const dataPoints: KnowledgeDataPoint[] = (parsed.data_points || parsed.dataPoints || []).map((dataPoint: any, index: number) => ({
      id: makeId('ai-dp', `${index}`, dataPoint.metricName || `${index}`),
      metricName: cleanText(dataPoint.metricName || 'metric'),
      metricValueText: cleanText(dataPoint.metricValueText || dataPoint.value || ''),
      metricValueNum: typeof dataPoint.metricValueNum === 'number' ? dataPoint.metricValueNum : parseFlexibleNumber(dataPoint.value),
      unit: cleanText(dataPoint.unit || ''),
      confidence: typeof dataPoint.confidence === 'number' ? dataPoint.confidence : 0.73,
      sourceChunkId: dataPoint.sourceChunkId || payload[0]?.id || 'unknown',
      semanticContext: dataPoint.semanticContext || payload[0]?.context || context.category,
    }));

    return { entities, relationships, insights, dataPoints };
  } catch {
    return null;
  }
};

export async function runDocumentIngestionPipeline(context: IngestionDocumentContext): Promise<IngestionPipelineResult> {
  const parsed = DocumentParserAgent.run(context);
  const chunks = SemanticChunkerAgent.run(parsed);
  const localKnowledge = buildLocalKnowledge(chunks);
  const aiKnowledge = await maybeEnrichWithAi(context, chunks);

  const mergedKnowledge = dedupeKnowledge({
    entities: [...localKnowledge.entities, ...(aiKnowledge?.entities || [])],
    relationships: [...localKnowledge.relationships, ...(aiKnowledge?.relationships || [])],
    insights: [...localKnowledge.insights, ...(aiKnowledge?.insights || [])],
    dataPoints: [...localKnowledge.dataPoints, ...(aiKnowledge?.dataPoints || [])],
  });

  const qualityGate = applyQualityGate(parsed, chunks, mergedKnowledge, !!context.strictMode);
  const summary = `Parsed ${parsed.sections.length} sections, ${chunks.length} semantic chunks, ${mergedKnowledge.entities.length} entities, and ${mergedKnowledge.relationships.length} relationships.`;

  return {
    parsed,
    chunks,
    knowledge: mergedKnowledge,
    qualityGate,
    summary,
    agentAudit: {
      extractionQuality: 'critical-failure',
      dataModeling: 'redesign-required',
      agentResponsibilities: 'split-required',
      findings: [
        'Legacy ingestion relied on one broad extraction step with weak semantic segmentation.',
        'Structured knowledge and relationships were not persisted for downstream reasoning.',
        'Extraction, interpretation, and storage responsibilities were previously mixed in one function.',
      ],
    },
  };
}

export async function persistIngestionArtifacts(supabase: any, params: {
  documentId: string;
  companyId: string;
  parsed: ParsedDocument;
  chunks: SemanticChunk[];
  knowledge: ExtractedKnowledge;
  qualityGate: QualityGateResult;
  summary: string;
  legacyExtraction: Record<string, unknown>;
}) {
  const runId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `run-${Date.now()}`;
  const timestamp = nowIso();

  await Promise.all([
    supabase.from('document_sections').delete().eq('document_id', params.documentId),
    supabase.from('document_chunks').delete().eq('document_id', params.documentId),
    supabase.from('knowledge_entities').delete().eq('document_id', params.documentId),
    supabase.from('knowledge_relationships').delete().eq('document_id', params.documentId),
    supabase.from('knowledge_insights').delete().eq('document_id', params.documentId),
    supabase.from('knowledge_data_points').delete().eq('document_id', params.documentId),
  ]);

  await supabase.from('document_ingestion_runs').insert({
    id: runId,
    document_id: params.documentId,
    company_id: params.companyId,
    pipeline_version: 'v2-multi-agent',
    status: params.qualityGate.accepted ? 'completed' : 'failed',
    quality_score: params.qualityGate.score,
    issues: params.qualityGate.issues,
    summary: params.summary,
    completed_at: timestamp,
  });

  if (params.parsed.sections.length > 0) {
    await supabase.from('document_sections').insert(params.parsed.sections.map((section) => ({
      id: section.id,
      document_id: params.documentId,
      company_id: params.companyId,
      heading: section.heading,
      level: section.level,
      section_type: section.kind,
      content: section.content,
      semantic_context: section.semanticContext,
      order_index: section.order,
      created_at: timestamp,
    })));
  }

  if (params.chunks.length > 0) {
    await supabase.from('document_chunks').insert(params.chunks.map((chunk) => ({
      id: chunk.id,
      run_id: runId,
      document_id: params.documentId,
      company_id: params.companyId,
      section_id: chunk.sectionId,
      chunk_type: chunk.type,
      content: chunk.content,
      context: chunk.context,
      semantic_context: chunk.semanticContext,
      source_ref: chunk.sourceRef,
      confidence: chunk.confidence,
      embedding: chunk.embedding,
      created_at: timestamp,
    })));
  }

  if (params.knowledge.entities.length > 0) {
    await supabase.from('knowledge_entities').insert(params.knowledge.entities.map((entity) => ({
      id: entity.id,
      document_id: params.documentId,
      company_id: params.companyId,
      canonical_name: entity.canonicalName,
      entity_type: entity.entityType,
      aliases: entity.aliases,
      confidence: entity.confidence,
      source_chunk_id: entity.sourceChunkId,
      source_section_ref: entity.sourceSectionRef,
      semantic_context: entity.semanticContext,
      metadata: entity.metadata || {},
      created_at: timestamp,
    })));
  }

  if (params.knowledge.relationships.length > 0) {
    await supabase.from('knowledge_relationships').insert(params.knowledge.relationships.map((relationship) => ({
      id: relationship.id,
      document_id: params.documentId,
      company_id: params.companyId,
      from_entity_id: relationship.fromEntityId,
      to_entity_id: relationship.toEntityId,
      relation_type: relationship.relationType,
      evidence: relationship.evidence,
      confidence: relationship.confidence,
      source_chunk_id: relationship.sourceChunkId,
      semantic_context: relationship.semanticContext,
      created_at: timestamp,
    })));
  }

  if (params.knowledge.insights.length > 0) {
    await supabase.from('knowledge_insights').insert(params.knowledge.insights.map((insight) => ({
      id: insight.id,
      document_id: params.documentId,
      company_id: params.companyId,
      insight_type: insight.insightType,
      summary: insight.summary,
      evidence: insight.evidence,
      confidence: insight.confidence,
      source_chunk_id: insight.sourceChunkId,
      semantic_context: insight.semanticContext,
      created_at: timestamp,
    })));
  }

  if (params.knowledge.dataPoints.length > 0) {
    await supabase.from('knowledge_data_points').insert(params.knowledge.dataPoints.map((dataPoint) => ({
      id: dataPoint.id,
      document_id: params.documentId,
      company_id: params.companyId,
      metric_name: dataPoint.metricName,
      metric_value_text: dataPoint.metricValueText,
      metric_value_num: dataPoint.metricValueNum,
      unit: dataPoint.unit,
      confidence: dataPoint.confidence,
      source_chunk_id: dataPoint.sourceChunkId,
      semantic_context: dataPoint.semanticContext,
      created_at: timestamp,
    })));
  }

  await supabase.from('company_documents').update({
    raw_text: params.parsed.rawText,
    cleaned_text: params.parsed.cleanedText,
    parsed_structure: {
      sections: params.parsed.sections.map((section) => ({
        id: section.id,
        heading: section.heading,
        type: section.kind,
        level: section.level,
      })),
    },
    semantic_summary: {
      summary: params.summary,
      entities: params.knowledge.entities.length,
      relationships: params.knowledge.relationships.length,
      insights: params.knowledge.insights.length,
      dataPoints: params.knowledge.dataPoints.length,
    },
    quality_score: params.qualityGate.score,
    processing_trace: {
      timestamp,
      status: params.qualityGate.accepted ? 'completed' : 'failed',
      qualityGate: params.qualityGate,
      agents: AGENT_DEFINITIONS,
    },
    extracted_data: params.legacyExtraction,
  }).eq('id', params.documentId);

  return { runId };
}
