import * as XLSX from 'xlsx';

export type SupportedAttachmentType = 'eml' | 'msg' | 'pdf' | 'xlsx' | 'xls' | 'docx' | 'doc' | 'txt';

export interface ParsedProductAttachment {
  product_name: string | null;
  description: string | null;
  supplier: string | null;
  supplier_contact: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    position?: string | null;
  };
  pricing: {
    unit_price?: number | null;
    currency?: string;
    total_offer?: number | null;
    discount?: number | null;
    tax_rate?: number | null;
    valid_until?: string | null;
  };
  cost_breakdown: Array<{ item: string; cost: number; currency?: string; quantity?: number }>;
  quantities: {
    minimum?: number | null;
    offered?: number | null;
    unit?: string | null;
  };
  dates: {
    offer_date?: string | null;
    delivery_date?: string | null;
    valid_until?: string | null;
  };
  reference_numbers: {
    quote?: string | null;
    invoice?: string | null;
    po?: string | null;
    order?: string | null;
  };
  specifications: Record<string, string>;
  attachments_mentioned: string[];
  raw_text_summary: string;
  confidence_score: number;
  source_file: string;
  file_type: string;
}

const MAX_SUMMARY = 800;

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeNumber(value: string): number | null {
  let raw = value.trim();
  if (!raw) return null;
  raw = raw.replace(/[€$£]/g, '').replace(/\s+/g, '');
  if (raw.includes(',') && raw.includes('.')) {
    raw = raw.lastIndexOf(',') > raw.lastIndexOf('.')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '');
  } else if ((raw.match(/,/g) || []).length > 1) {
    raw = raw.replace(/,/g, '');
  } else if ((raw.match(/\./g) || []).length > 1) {
    raw = raw.replace(/\./g, '');
  } else if (raw.includes(',')) {
    const [left, right] = raw.split(',');
    raw = right && right.length === 3 ? `${left}${right}` : `${left}.${right || ''}`;
  }

  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeDecode(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  } catch {
    return new TextDecoder('latin1').decode(buffer);
  }
}

function binaryToSearchableText(buffer: ArrayBuffer): string {
  const text = safeDecode(buffer);
  const tokens = text.match(/[A-Za-z0-9@._%+\-/:#]{3,}|[\u00C0-\u017F]{2,}[A-Za-z\u00C0-\u017F0-9\s.,:/#\-]{2,}/g);
  return tokens ? tokens.join(' ') : text;
}

export class ProductAttachmentParser {
  async parse(file: File): Promise<ParsedProductAttachment> {
    const extension = (file.name.split('.').pop() || 'txt').toLowerCase() as SupportedAttachmentType;
    const rawText = await this.parseRawText(file, extension);
    const extracted = this.extractFromText(rawText, file.name, extension);
    return extracted;
  }

  private async parseRawText(file: File, extension: SupportedAttachmentType): Promise<string> {
    if (extension === 'txt' || extension === 'eml') {
      return file.text();
    }

    if (extension === 'xlsx' || extension === 'xls') {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const chunks: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
        chunks.push(`Sheet: ${sheetName}`);
        rows.slice(0, 300).forEach((row) => {
          if (Array.isArray(row)) {
            chunks.push(row.map((cell) => String(cell ?? '')).join(' | '));
          }
        });
      }
      return chunks.join('\n');
    }

    if (extension === 'msg' || extension === 'pdf' || extension === 'docx' || extension === 'doc') {
      const buffer = await file.arrayBuffer();
      return binaryToSearchableText(buffer);
    }

    return file.text();
  }

  private extractFromText(text: string, sourceFile: string, fileType: string): ParsedProductAttachment {
    const productName = this.findProductName(text);
    const supplier = this.findSupplier(text);
    const supplierContact = this.findContactInfo(text);
    const pricing = this.extractPricing(text);
    const costBreakdown = this.extractCostBreakdown(text);
    const quantities = this.extractQuantities(text);
    const dates = this.extractDates(text);
    const referenceNumbers = this.extractReferences(text);
    const specifications = this.extractSpecifications(text);
    const description = this.buildDescription({
      productName,
      supplier,
      pricing,
      sourceText: text,
    });

    const confidenceSignals = [
      !!productName,
      !!supplier,
      pricing.unit_price != null,
      pricing.total_offer != null,
      !!referenceNumbers.quote || !!referenceNumbers.po,
    ].filter(Boolean).length;

    return {
      product_name: productName,
      description,
      supplier,
      supplier_contact: supplierContact,
      pricing,
      cost_breakdown: costBreakdown,
      quantities,
      dates,
      reference_numbers: referenceNumbers,
      specifications,
      attachments_mentioned: this.extractAttachmentsMentioned(text),
      raw_text_summary: text.length > MAX_SUMMARY ? `${text.slice(0, MAX_SUMMARY)}...` : text,
      confidence_score: Math.min(confidenceSignals / 5, 1),
      source_file: sourceFile,
      file_type: fileType,
    };
  }

  private findProductName(text: string): string | null {
    const patterns = [
      /(?:producto|art[íi]culo|item|servicio|product|reference)\s*[:=#-]?\s*([^\n]{3,120})/i,
      /(?:oferta|cotizaci[óo]n|quote|offer|proposal)\s*(?:para|for)?\s*[:#-]?\s*([^\n]{3,120})/i,
      /^subject:\s*(.+)$/im,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (!match) continue;
      const candidate = compactWhitespace(match[1]);
      if (candidate.length >= 3 && !/^re:|^fw:|^fwd:/i.test(candidate)) {
        return candidate.slice(0, 200);
      }
    }

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 10);

    const fallback = lines.find((line) => /^[A-Z\u00C0-\u017F]/.test(line) && line.length > 4 && line.length < 100);
    return fallback || null;
  }

  private findSupplier(text: string): string | null {
    const patterns = [
      /(?:proveedor|supplier|vendor|fabricante|manufacturer|company|empresa)\s*[:=\-]?\s*([^\n]{3,100})/i,
      /(?:from|de|by)\s*[:=\-]?\s*([A-Z\u00C0-\u017F][A-Za-z\u00C0-\u017F\s&.,]{3,80})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (!match) continue;
      const supplier = compactWhitespace(match[1]);
      if (supplier.length > 2) return supplier.slice(0, 120);
    }

    const fromHeader = text.match(/^from:\s*(.+)$/im);
    if (fromHeader?.[1]) {
      const domain = fromHeader[1].match(/@([a-z0-9-]+)\./i);
      if (domain?.[1]) {
        return domain[1].charAt(0).toUpperCase() + domain[1].slice(1);
      }
    }

    return null;
  }

  private findContactInfo(text: string): ParsedProductAttachment['supplier_contact'] {
    const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null;
    const phone = text.match(/(?:tel|phone|mobile|m[óo]vil|tfno)?\s*[:.+-]?\s*(\+?[0-9][0-9\s().-]{6,18})/i)?.[1] || null;
    const name = text.match(/(?:contacto|contact|attn|atenci[óo]n|responsable)\s*[:=\-]?\s*([A-Z\u00C0-\u017F][^\n]{3,60})/i)?.[1] || null;

    return {
      email,
      phone: phone ? compactWhitespace(phone) : null,
      name: name ? compactWhitespace(name) : null,
      position: null,
    };
  }

  private extractPricing(text: string): ParsedProductAttachment['pricing'] {
    const currency = text.includes('€') || /\bEUR\b/i.test(text)
      ? 'EUR'
      : text.includes('$') || /\bUSD\b/i.test(text)
        ? 'USD'
        : text.includes('£') || /\bGBP\b/i.test(text)
          ? 'GBP'
          : 'EUR';

    const unitMatch = text.match(/(?:precio\s*unitario|unit\s*price|price\s*per\s*(?:unit|item|ud)|coste\s*unitario)\s*[:=\-]?\s*[€$£]?\s*([\d.,]+)/i)
      || text.match(/[€$£]\s*([\d.,]+)\s*(?:\/|por|per)\s*(?:ud|unit|item|each|pieza)/i);
    const totalMatch = text.match(/(?:importe\s*total|total\s*(?:offer|amount|price)?|grand\s*total|suma)\s*[:=\-]?\s*[€$£]?\s*([\d.,]+)/i);
    const discountMatch = text.match(/(?:descuento|discount|dto)\s*[:=\-]?\s*([\d.,]+)\s*%?/i);
    const taxMatch = text.match(/(?:iva|vat|tax|impuesto)\s*[:=\-]?\s*([\d.,]+)\s*%?/i);

    return {
      unit_price: unitMatch ? normalizeNumber(unitMatch[1]) : null,
      total_offer: totalMatch ? normalizeNumber(totalMatch[1]) : null,
      discount: discountMatch ? normalizeNumber(discountMatch[1]) : null,
      tax_rate: taxMatch ? normalizeNumber(taxMatch[1]) : null,
      valid_until: this.extractDates(text).valid_until || null,
      currency,
    };
  }

  private extractCostBreakdown(text: string): ParsedProductAttachment['cost_breakdown'] {
    const rows = text.split(/\r?\n/);
    const breakdown: ParsedProductAttachment['cost_breakdown'] = [];

    rows.forEach((row) => {
      const match = row.match(/^([A-Za-z\u00C0-\u017F][A-Za-z0-9\u00C0-\u017F\s().,_\-/]{2,80})\s+[€$£]?\s*([\d.,]{1,20})(?:\s*(?:x|qty|cantidad)\s*([\d.,]+))?/i);
      if (!match) return;
      const item = compactWhitespace(match[1]);
      const cost = normalizeNumber(match[2]);
      const quantity = match[3] ? normalizeNumber(match[3]) : null;
      if (!cost || cost <= 0) return;
      breakdown.push({
        item,
        cost,
        quantity: quantity ? Math.round(quantity) : undefined,
        currency: 'EUR',
      });
    });

    return breakdown.slice(0, 20);
  }

  private extractQuantities(text: string): ParsedProductAttachment['quantities'] {
    const offeredMatch = text.match(/(?:cantidad|quantity|qty|unidades|units)\s*[:=\-]?\s*([\d.,]+)/i)
      || text.match(/([\d.,]+)\s*(?:unidades|uds|units|pcs|piezas)/i);
    const minimumMatch = text.match(/(?:m[íi]nimo|minimum|min\.?\s*order|pedido\s*m[íi]nimo)\s*[:=\-]?\s*([\d.,]+)/i);
    const unitMatch = text.match(/(?:unidad|unit|measure|medida)\s*[:=\-]?\s*(piezas|unidades|kg|m2|m\^2|m²|litros|l|horas|h|d[íi]as|servicio|pcs)/i);

    return {
      offered: offeredMatch ? normalizeNumber(offeredMatch[1]) : null,
      minimum: minimumMatch ? normalizeNumber(minimumMatch[1]) : null,
      unit: unitMatch?.[1] || null,
    };
  }

  private extractDates(text: string): ParsedProductAttachment['dates'] {
    const dateToken = '(\\d{1,2}[/-.]\\d{1,2}[/-.]\\d{2,4}|\\d{4}[/-.]\\d{1,2}[/-.]\\d{1,2})';
    const offerDate = text.match(new RegExp(`(?:fecha|date|emitido|issued)\\s*[:=\\-]?\\s*${dateToken}`, 'i'))?.[1] || null;
    const deliveryDate = text.match(new RegExp(`(?:entrega|delivery|deadline|plazo)\\s*(?:estimada|prevista)?\\s*[:=\\-]?\\s*${dateToken}`, 'i'))?.[1] || null;
    const validUntil = text.match(new RegExp(`(?:validez|v[aá]lido|valid|vence|caduca|expires)\\s*(?:hasta|until|el)?\\s*[:=\\-]?\\s*${dateToken}`, 'i'))?.[1] || null;

    return {
      offer_date: offerDate,
      delivery_date: deliveryDate,
      valid_until: validUntil,
    };
  }

  private extractReferences(text: string): ParsedProductAttachment['reference_numbers'] {
    const capture = (pattern: RegExp) => text.match(pattern)?.[1] || null;
    return {
      quote: capture(/(?:oferta|cotizaci[óo]n|presupuesto|quote|proposal)\s*(?:n[º°o]|num|number|#)?\s*[:=\-]?\s*([A-Z0-9\-/]{3,30})/i),
      invoice: capture(/(?:factura|invoice|bill)\s*(?:n[º°o]|num|number|#)?\s*[:=\-]?\s*([A-Z0-9\-/]{3,30})/i),
      po: capture(/(?:pedido|purchase\s*order|po|orden\s*de\s*compra)\s*(?:n[º°o]|num|number|#)?\s*[:=\-]?\s*([A-Z0-9\-/]{3,30})/i),
      order: capture(/(?:order|encargo)\s*(?:n[º°o]|num|number|#)?\s*[:=\-]?\s*([A-Z0-9\-/]{3,30})/i),
    };
  }

  private extractSpecifications(text: string): Record<string, string> {
    const keys = [
      'dimensiones', 'dimensions', 'peso', 'weight', 'material', 'color',
      'potencia', 'power', 'voltaje', 'voltage', 'capacidad', 'capacity',
      'velocidad', 'speed', 'temperatura', 'temperature', 'garantia', 'warranty',
    ];

    const result: Record<string, string> = {};
    keys.forEach((key) => {
      const pattern = new RegExp(`${key}\\s*[:=\\-]?\\s*([^\\n]+)`, 'i');
      const match = text.match(pattern);
      if (match?.[1]) {
        result[key] = compactWhitespace(match[1]).slice(0, 180);
      }
    });

    return result;
  }

  private extractAttachmentsMentioned(text: string): string[] {
    const matches = text.match(/\b[^\s]+\.(pdf|xlsx|xls|docx|doc|txt|eml|msg)\b/gi) || [];
    return Array.from(new Set(matches));
  }

  private buildDescription(input: {
    productName: string | null;
    supplier: string | null;
    pricing: ParsedProductAttachment['pricing'];
    sourceText: string;
  }): string {
    const parts: string[] = [];
    if (input.productName) parts.push(`Product: ${input.productName}`);
    if (input.supplier) parts.push(`Supplier: ${input.supplier}`);
    if (input.pricing.unit_price != null) parts.push(`Unit price: ${input.pricing.unit_price} ${input.pricing.currency || 'EUR'}`);
    if (input.pricing.total_offer != null) parts.push(`Total offer: ${input.pricing.total_offer} ${input.pricing.currency || 'EUR'}`);
    if (input.pricing.discount != null) parts.push(`Discount: ${input.pricing.discount}%`);

    let description = parts.join(' | ');
    if (description.length < 40) {
      const firstLongLine = input.sourceText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 20);
      if (firstLongLine) {
        description = `${description}${description ? ' ' : ''}${firstLongLine}`;
      }
    }

    return description.slice(0, 500);
  }
}
