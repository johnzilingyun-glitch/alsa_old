import { z } from 'zod';

// Loose shell: validates core fields that must exist for rendering
// Missing optional fields won't block the UI

const StockInfoSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  price: z.coerce.number(),
  change: z.coerce.number(),
  changePercent: z.coerce.number(),
  market: z.enum(['A-Share', 'HK-Share', 'US-Share']),
  currency: z.string(),
  lastUpdated: z.string(),
  previousClose: z.coerce.number().optional().default(0),
  dailyHigh: z.coerce.number().optional(),
  dailyLow: z.coerce.number().optional(),
  dataFreshness: z.string().optional(),
  dataSource: z.string().optional(),
  sourceWeight: z.coerce.number().optional(),
  dataQuality: z.any().optional(),
  technicalIndicators: z.any().optional(),
  pe: z.coerce.number().optional(),
  peForward: z.coerce.number().optional(),
  pb: z.coerce.number().optional(),
  eps: z.coerce.number().optional(),
  epsForward: z.coerce.number().optional(),
  dividendYield: z.coerce.number().optional(),
  roe: z.coerce.number().optional(),
  revenueGrowth: z.coerce.number().optional(),
  debtToEquity: z.coerce.number().optional(),
  marketCap: z.coerce.number().optional(),
  volume: z.coerce.number().optional(),
});

const TradingPlanSchema = z.object({
  entryPrice: z.string().default(''),
  targetPrice: z.string().default(''),
  stopLoss: z.string().default(''),
  strategy: z.string().default(''),
  strategyRisks: z.string().optional().default(''),
  positionPlan: z.array(z.object({
    price: z.string(),
    positionPercent: z.number(),
  })).optional(),
  logicBasedStopLoss: z.string().optional(),
  riskRewardRatio: z.number().optional(),
}).optional();

export const StockAnalysisSchema = z.object({
  stockInfo: StockInfoSchema,
  summary: z.string().default(''),
  technicalAnalysis: z.string().default(''),
  fundamentalAnalysis: z.string().default(''),
  sentiment: z.enum(['Bullish', 'Bearish', 'Neutral']).catch('Neutral'),
  score: z.number().min(0).max(100).catch(50),
  recommendation: z.enum(['Buy', 'Overweight', 'Hold', 'Underweight', 'Sell']).catch('Hold'),
  keyRisks: z.array(z.string()).catch([]),
  keyOpportunities: z.array(z.string()).catch([]),
  news: z.array(z.any()).catch([]),
  fundamentals: z.object({
    pe: z.string().optional(),
    pb: z.string().optional(),
    roe: z.string().optional(),
    eps: z.string().optional(),
    revenueGrowth: z.string().optional(),
    valuationPercentile: z.string().optional(),
    netProfitGrowth: z.string().optional(),
    debtToEquity: z.string().optional(),
    grossMargin: z.string().optional(),
    netMargin: z.string().optional(),
    dividendYield: z.string().optional(),
    marketCap: z.string().optional(),
    revenue: z.string().optional(),
    netProfit: z.string().optional(),
    nonGaapNetProfit: z.string().optional(),
    dividend: z.string().optional(),
  }).optional(),
  tradingPlan: TradingPlanSchema,
  technicalIndicators: z.any().optional(),
  // All remaining fields pass through un-validated
}).passthrough();

const AgentMessageSchema = z.object({
  role: z.string(),
  content: z.string().catch(''),
  timestamp: z.string(),
  type: z.string().optional(),
  references: z.array(z.any()).optional(),
  id: z.string().optional(),
});

export const AgentDiscussionSchema = z.object({
  messages: z.array(AgentMessageSchema),
  finalConclusion: z.string().default(''),
  tradingPlan: TradingPlanSchema,
  coreVariables: z.array(z.any()).optional().default([]),
  quantifiedRisks: z.array(z.any()).optional().default([]),
  scenarios: z.array(z.any()).optional().default([]),
  moatAnalysis: z.any().optional(),
  industryAnchors: z.array(z.any()).optional().default([]),
  expectationGap: z.any().optional(),
  calculations: z.array(z.any()).optional().default([]),
  businessModel: z.any().optional(),
  // All remaining fields pass through un-validated
}).passthrough();

export const MarketOverviewSchema = z.object({
  indices: z.array(z.object({
    name: z.string(),
    symbol: z.string(),
    price: z.coerce.number(),
    change: z.coerce.number(),
    changePercent: z.coerce.number(),
    previousClose: z.coerce.number().optional().default(0),
  })).min(1).catch([]),
  topNews: z.array(z.any()).catch([]),
  sectorAnalysis: z.array(z.any()).catch([]),
  commodityAnalysis: z.array(z.any()).catch([]),
  recommendations: z.array(z.any()).catch([]),
  marketSummary: z.string().catch('').default(''),
}).passthrough();

/**
 * Safe parse that returns the data on success or throws with details on failure.
 * Uses .catch() defaults so partial data doesn't block rendering.
 */
export function validateResponse<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  console.error(`[Validation] ${label} failed:`, JSON.stringify(result.error.issues, null, 2));
  throw new Error(`${label} 数据验证失败: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
}
