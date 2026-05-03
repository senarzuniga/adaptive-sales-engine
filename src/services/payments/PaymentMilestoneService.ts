import { supabase } from '@/integrations/supabase/client';
import type {
  CashFlowData,
  ClientMilestone,
  SupplierPayment,
} from '@/services/payments/CashFlowGenerator';
import type { OptimizationScenario } from '@/services/payments/CashFlowOptimizationAgent';

export interface CostConcept {
  id: string;
  offer_id?: string;
  concept_name: string;
  total_cost: number;
  cost_type?: string;
  supplier_id?: string | null;
  notes?: string;
  supplier_payments: SupplierPayment[];
}

export interface PaymentTermsValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class PaymentMilestoneService {
  private async invoke<T>(body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke('offers-api', { body });
    if (error) throw new Error(error.message);
    if ((data as any)?.error) throw new Error(String((data as any).error));
    return data as T;
  }

  async upsertClientMilestones(offerId: string, milestones: Partial<ClientMilestone>[]) {
    const data = await this.invoke<{ milestones: ClientMilestone[] }>({
      action: 'offers.payment-milestones.replace',
      offerId,
      milestones,
    });
    return data.milestones || [];
  }

  async getClientMilestones(offerId: string) {
    const data = await this.invoke<{ milestones: ClientMilestone[] }>({
      action: 'offers.payment-milestones.list',
      offerId,
    });
    return data.milestones || [];
  }

  async updateClientMilestone(offerId: string, milestoneId: string, patch: Partial<ClientMilestone>) {
    const data = await this.invoke<{ milestone: ClientMilestone }>({
      action: 'offers.payment-milestones.update',
      offerId,
      milestoneId,
      patch,
    });
    return data.milestone;
  }

  async deleteClientMilestone(offerId: string, milestoneId: string) {
    await this.invoke({ action: 'offers.payment-milestones.delete', offerId, milestoneId });
  }

  async replaceCostConcepts(offerId: string, concepts: Partial<CostConcept>[]) {
    await this.invoke({
      action: 'offers.cost-concepts.replace',
      offerId,
      concepts,
    });
  }

  async getCostConcepts(offerId: string) {
    const data = await this.invoke<{ concepts: CostConcept[] }>({
      action: 'offers.cost-concepts.list',
      offerId,
    });
    return data.concepts || [];
  }

  async createCostConcept(offerId: string, payload: Partial<CostConcept>) {
    const data = await this.invoke<{ concept: CostConcept }>({
      action: 'offers.cost-concepts.create',
      offerId,
      payload,
    });
    return data.concept;
  }

  async updateCostConcept(offerId: string, conceptId: string, patch: Partial<CostConcept>) {
    const data = await this.invoke<{ concept: CostConcept }>({
      action: 'offers.cost-concepts.update',
      offerId,
      conceptId,
      patch,
    });
    return data.concept;
  }

  async deleteCostConcept(offerId: string, conceptId: string) {
    await this.invoke({ action: 'offers.cost-concepts.delete', offerId, conceptId });
  }

  async addSupplierPayment(offerId: string, conceptId: string, payload: Partial<SupplierPayment>) {
    const data = await this.invoke<{ payment: SupplierPayment }>({
      action: 'offers.supplier-payments.create',
      offerId,
      conceptId,
      payload,
    });
    return data.payment;
  }

  async updateSupplierPayment(offerId: string, paymentId: string, patch: Partial<SupplierPayment>) {
    const data = await this.invoke<{ payment: SupplierPayment }>({
      action: 'offers.supplier-payments.update',
      offerId,
      paymentId,
      patch,
    });
    return data.payment;
  }

  async deleteSupplierPayment(offerId: string, paymentId: string) {
    await this.invoke({ action: 'offers.supplier-payments.delete', offerId, paymentId });
  }

  async generateCashFlow(offerId: string, contractStartDate?: string) {
    return this.invoke<CashFlowData>({
      action: 'offers.cash-flow.generate',
      offerId,
      contractStartDate,
    });
  }

  async optimizeCashFlow(offerId: string, contractStartDate?: string) {
    const data = await this.invoke<{ scenarios: OptimizationScenario[] }>({
      action: 'offers.cash-flow.optimize',
      offerId,
      contractStartDate,
    });
    return data.scenarios || [];
  }

  async applyScenario(offerId: string, scenarioId: string) {
    return this.invoke<{ success: boolean; milestones: ClientMilestone[] }>({
      action: 'offers.cash-flow.apply-scenario',
      offerId,
      scenarioId,
    });
  }

  async exportCashFlowCsv(offerId: string, contractStartDate?: string) {
    const data = await this.invoke<{ format: 'csv'; content: string }>({
      action: 'offers.cash-flow.export',
      offerId,
      contractStartDate,
    });
    return data.content || '';
  }

  async validatePaymentTerms(offerId: string): Promise<PaymentTermsValidation> {
    return this.invoke<PaymentTermsValidation>({
      action: 'offers.payment-terms.validate',
      offerId,
    });
  }
}
