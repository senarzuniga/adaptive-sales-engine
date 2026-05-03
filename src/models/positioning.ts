export type ProductLifecycle =
  | 'introduction'
  | 'growth'
  | 'maturity'
  | 'saturation'
  | 'decline'
  | 'obsolescence';

export type CompetitivePosition =
  | 'leader'
  | 'challenger'
  | 'niche'
  | 'follower'
  | 'disruptor'
  | 'commodity';

export type PricingStrategy =
  | 'premium'
  | 'value_based'
  | 'competitive'
  | 'penetration'
  | 'skimming'
  | 'cost_plus';

export type SalesApproach =
  | 'consultative'
  | 'transactional'
  | 'solution_selling'
  | 'value_selling'
  | 'challenger_sale'
  | 'relationship';

export interface ProductPositioning {
  productId: string;
  sku: string;
  name: string;
  lifecycleStage: ProductLifecycle;
  lifecycleConfidence: number;
  competitivePosition: CompetitivePosition;
  marketMaturity: 'emerging' | 'growing' | 'mature' | 'declining';
  technologyTrajectory: 'cutting_edge' | 'growing' | 'stable' | 'aging' | 'obsolete';
  commoditizationRisk: number;
  differentiationScore: number;
  pricingPower: 'high' | 'medium' | 'low';
  recommendedSalesApproach: SalesApproach;
  pricingStrategy: PricingStrategy;
  valueProposition: string;
  targetCustomerProfile: string;
  competitiveAdvantages: string[];
  vulnerabilities: string[];
  adjacentOpportunities: string[];
  analysisTimestamp: string;
}

export interface PortfolioAnalysis {
  totalProducts: number;
  lifecycleDistribution: Record<ProductLifecycle, number>;
  revenueConcentration: number;
  innovationRatio: number;
  cashCowRatio: number;
  declineExposure: number;
  portfolioHealthScore: number;
  strategicRecommendations: string[];
  riskFactors: string[];
  growthOpportunities: string[];
}

export interface CompetitiveLandscape {
  productId: string;
  directCompetitors: Array<{ name: string; position: string; threatLevel: 'low' | 'medium' | 'high' }>;
  substituteThreats: string[];
  barrierToEntry: 'low' | 'medium' | 'high';
  competitiveIntensity: 'low' | 'medium' | 'high';
  pricePosition: 'premium' | 'parity' | 'discount';
  marketShareEstimate?: number;
  keyDifferentiators: string[];
  competitiveAdvantageSustainability: 'temporary' | 'sustainable' | 'defensible';
}

export interface StrategyRoadmap {
  productId: string;
  shortTermActions: Array<{ title: string; owner: string; expectedImpact: number }>;
  mediumTermInitiatives: Array<{ title: string; owner: string; expectedImpact: number }>;
  longTermStrategicMoves: Array<{ title: string; owner: string; expectedImpact: number }>;
  salesScripts: Array<{ scenario: string; script: string }>;
  supportContentNeeded: string[];
  trainingRecommendations: string[];
  roiProjections: Record<string, number>;
}
