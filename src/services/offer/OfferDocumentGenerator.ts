import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from 'docx';
import { ContentLibraryService } from '@/services/offer/ContentLibraryService';
import { getTemplateByType, type OfferTemplateType, type OfferTemplateSection } from '@/services/offer/offerTemplates';
import type { ClientMilestone, SupplierPayment } from '@/services/payments/CashFlowGenerator';
import type { CostConcept } from '@/services/payments/PaymentMilestoneService';

export interface OfferDocumentData {
  id: string;
  serial_number: string;
  title: string;
  template_type: OfferTemplateType;
  valid_until?: string | null;
  total_amount?: number;
  currency?: string;
  offer_data?: Record<string, unknown>;
  created_by_name?: string;
  created_by_title?: string;
}

export class OfferDocumentGenerator {
  private readonly contentLibrary = new ContentLibraryService();

  async generateWord(
    offer: OfferDocumentData,
    selectedSectionIds: string[],
    contentAssignments: Map<string, string>,
    paymentData?: {
      clientMilestones?: ClientMilestone[];
      costConcepts?: CostConcept[];
    },
  ) {
    const template = getTemplateByType(offer.template_type);

    const children: Paragraph[] = [];
    for (const section of template.sections) {
      if (!selectedSectionIds.includes(section.id)) continue;
      children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }));
      const rendered = await this.renderSection(section, offer, contentAssignments.get(section.id));
      children.push(...rendered);
      children.push(new Paragraph({ text: '', pageBreakBefore: true }));
    }

    const legal = template.sections.find((section) => section.is_last_section);
    if (legal && selectedSectionIds.includes(legal.id)) {
      children.push(new Paragraph({ text: legal.title, heading: HeadingLevel.HEADING_1 }));
      children.push(new Paragraph({ text: 'GENERAL TERMS AND CONDITIONS', heading: HeadingLevel.HEADING_2 }));
      children.push(...await this.renderSection(legal, offer, contentAssignments.get(legal.id)));
      children.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun(`This offer is valid until ${offer.valid_until || 'N/A'}. Acceptance must be in writing.`),
          new TextRun({ text: `\n\n${offer.created_by_name || ''}\n${offer.created_by_title || ''}` }),
        ],
      }));
    }

    const clientMilestones = paymentData?.clientMilestones || [];
    if (clientMilestones.length > 0) {
      children.push(...this.buildPaymentTermsSection(offer, clientMilestones));
    }

    const costConcepts = paymentData?.costConcepts || [];
    if (costConcepts.length > 0) {
      children.push(...this.buildCostBreakdownSection(costConcepts));
    }

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: 'Calibri', size: 24 },
          },
        },
      },
      sections: [{ children }],
    });

    return Packer.toBuffer(doc);
  }

  private async renderSection(section: OfferTemplateSection, offer: OfferDocumentData, assignedBlockId?: string) {
    const rows: Paragraph[] = [];

    if (!assignedBlockId) {
      rows.push(new Paragraph({ text: `No content assigned for ${section.title}.` }));
      return rows;
    }

    const blocks = await this.contentLibrary.getContentBlocks();
    const block = blocks.find((item) => item.id === assignedBlockId);
    if (!block) {
      rows.push(new Paragraph({ text: `Content block ${assignedBlockId} not found.` }));
      return rows;
    }

    await this.contentLibrary.markBlockUsed(block.id);

    const renderedText = this.substituteVariables(block.content, offer);
    const paragraphs = renderedText
      .split(/\n{2,}/g)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    if (paragraphs.length === 0) {
      rows.push(new Paragraph({ text: ' ' }));
      return rows;
    }

    paragraphs.forEach((text) => rows.push(new Paragraph({ text })));
    return rows;
  }

  private substituteVariables(content: string, offer: OfferDocumentData) {
    const data = {
      'offer.serial_number': offer.serial_number,
      'offer.total_amount': `${offer.total_amount || 0} ${offer.currency || 'EUR'}`,
      'offer.valid_until': offer.valid_until || '',
      'client.company_name': String(offer.offer_data?.client_name || offer.offer_data?.customer_name || ''),
      'sales_rep.name': String(offer.offer_data?.sales_rep_name || offer.created_by_name || ''),
      'sales_rep.email': String(offer.offer_data?.sales_rep_email || ''),
    };

    return content.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, key) => {
      const normalized = String(key || '').trim();
      return data[normalized as keyof typeof data] || '';
    });
  }

  private buildPaymentTermsSection(offer: OfferDocumentData, milestones: ClientMilestone[]) {
    const total = Number(offer.total_amount || 0);
    const sorted = milestones
      .slice()
      .sort((a, b) => a.milestone_number - b.milestone_number);

    const rows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Milestone')] }),
          new TableCell({ children: [new Paragraph('Description')] }),
          new TableCell({ children: [new Paragraph('Percentage')] }),
          new TableCell({ children: [new Paragraph('Amount')] }),
          new TableCell({ children: [new Paragraph('Expected Date')] }),
        ],
      }),
      ...sorted.map((milestone) => {
        const amount = Number(((total * Number(milestone.percentage || 0)) / 100).toFixed(2));
        return new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(`H${milestone.milestone_number}`)] }),
            new TableCell({ children: [new Paragraph(milestone.milestone_title)] }),
            new TableCell({ children: [new Paragraph(`${Number(milestone.percentage || 0).toFixed(2)}%`)] }),
            new TableCell({ children: [new Paragraph(`${amount.toLocaleString()} ${offer.currency || 'EUR'}`)] }),
            new TableCell({ children: [new Paragraph(`${Number(milestone.expected_days_after_contract || 0)} days after contract`)] }),
          ],
        });
      }),
    ];

    return [
      new Paragraph({ text: 'PAYMENT TERMS AND CONDITIONS', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }),
      new Paragraph({
        text: 'The Client agrees to pay the total amount according to the following milestone schedule.',
      }),
      new Table({ rows }),
      new Paragraph({
        text: `Total Contract Value: ${total.toLocaleString()} ${offer.currency || 'EUR'}`,
        spacing: { before: 200 },
      }),
    ];
  }

  private buildCostBreakdownSection(costConcepts: CostConcept[]) {
    const nodes: Array<Paragraph | Table> = [
      new Paragraph({ text: 'COST BREAKDOWN AND SUPPLIER PAYMENTS', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }),
    ];

    costConcepts.forEach((concept) => {
      const payments = concept.supplier_payments || [];
      const rows = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('Payment Code')] }),
            new TableCell({ children: [new Paragraph('Description')] }),
            new TableCell({ children: [new Paragraph('Amount')] }),
            new TableCell({ children: [new Paragraph('Supplier')] }),
          ],
        }),
        ...payments.map((payment: SupplierPayment) => {
          const amount = Number(payment.amount || 0);
          return new TableRow({
            children: [
              new TableCell({ children: [new Paragraph(`P${payment.milestone_number}`)] }),
              new TableCell({ children: [new Paragraph(payment.milestone_title)] }),
              new TableCell({ children: [new Paragraph(amount.toLocaleString())] }),
              new TableCell({ children: [new Paragraph(payment.supplier_name || 'Various')] }),
            ],
          });
        }),
      ];

      nodes.push(new Paragraph({ text: concept.concept_name, heading: HeadingLevel.HEADING_2, spacing: { before: 180 } }));
      nodes.push(new Paragraph({ text: `Total: ${Number(concept.total_cost || 0).toLocaleString()} EUR` }));
      nodes.push(new Table({ rows }));
    });

    return nodes;
  }
}
