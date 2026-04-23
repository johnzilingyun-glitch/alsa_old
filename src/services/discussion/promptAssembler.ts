import { AgentRole, Language, StockAnalysis, AgentMessage } from '../../types';
import { TEMPORAL_ALIGNMENT_EN, TEMPORAL_ALIGNMENT_ZH } from './prompts/protocols/temporalAlignment';
import { DATA_PRIORITY_EN, DATA_PRIORITY_ZH } from './prompts/protocols/dataSourcePriority';
import { ROLE_INSTRUCTIONS_ZH, ROLE_INSTRUCTIONS_EN, ROLE_FOCUS_ZH, ROLE_FOCUS } from './expertPrompts';
import { 
  TECHNICAL_ANALYST_EXAMPLES_ZH, 
  CHIEF_STRATEGIST_EXAMPLES_ZH,
  TECHNICAL_ANALYST_EXAMPLES_EN,
  CHIEF_STRATEGIST_EXAMPLES_EN
} from './prompts/fewShot/examples';

interface AssemblerOptions {
  language?: Language;
  includeExamples?: boolean;
}

export async function assembleExpertPrompt(
  role: AgentRole,
  analysis: StockAnalysis,
  previousRounds: AgentMessage[],
  commoditiesData: any[],
  options: AssemblerOptions = {}
): Promise<string> {
  const language = options.language || 'en';
  const isZh = language === 'zh-CN';

  const sections: string[] = [];

  // 1. Get Persona
  const persona = isZh 
    ? `你是一位${role}，专注于：${ROLE_FOCUS_ZH[role]}\n${ROLE_INSTRUCTIONS_ZH[role]}`
    : `You are a ${role}, focused on: ${ROLE_FOCUS[role]}\n${ROLE_INSTRUCTIONS_EN[role]}`;
  sections.push(persona);

  // 1.1 Add mandatory instructions for depth and originality (these were missing/weak)
  sections.push(isZh
    ? `\n**深度与原创性要求 (MANDATORY)**:
1. **禁止复读**: 严禁简单重复前序专家的观点。如果你同意某人，必须提供**新的证据**或**更深的量化推导**。
2. **深度分析**: 这是一个 ${options.language === 'zh-CN' ? '深度研究' : 'Deep Research'} 模式。你的分析必须极尽详实，严禁敷衍。
3. **字数要求**: 你的分析内容必须详实，字数建议在 400-800 字之间。
4. **数据驱动**: 每一项结论都必须对应具体的数值或分析。`
    : `\n**DEPTH & ORIGINALITY REQUIREMENTS (MANDATORY)**:
1. **No Repetition**: Strictly prohibited from simply repeating previous experts' points.
2. **Exhaustive Analysis**: This is a Deep Research session. Your analysis must be extremely detailed.
3. **Length Requirement**: Suggested length is 400-800 words.
4. **Data-Driven**: Every conclusion must map to specific values or evidence.`);

  // 2. Protocols
  sections.push(isZh ? TEMPORAL_ALIGNMENT_ZH : TEMPORAL_ALIGNMENT_EN);
  sections.push(isZh ? DATA_PRIORITY_ZH : DATA_PRIORITY_EN);

  // 3. Examples (Few-Shot)
  if (options.includeExamples) {
    const examples = getRoleExamples(role, isZh);
    if (examples) sections.push(examples);
  }

  // 4. Context
  sections.push(`\n**Current Date Time**: ${new Date().toISOString()}`);
  
  if (commoditiesData && commoditiesData.length > 0) {
    sections.push(`\n**MACD ENVIRONMENTAL SWEEP**:`);
    commoditiesData.forEach(c => {
      sections.push(`- ${c.name}: ${c.price} ${c.unit || ''} (${c.changePercent > 0 ? '+' : ''}${c.changePercent}%)`);
    });
  }

  sections.push(`\n**Target Analysis**: ${analysis.stockInfo.symbol} - ${analysis.stockInfo.name}`);
  sections.push(`**Latest Price**: ${analysis.stockInfo.price} ${analysis.stockInfo.currency} (${analysis.stockInfo.changePercent > 0 ? '+' : ''}${analysis.stockInfo.changePercent}%)`);

  // Inject initial research grounding to prevent data loss compared to single-prompt mode
  sections.push(`\n**INITIAL CORE ANALYSIS (GROUND TRUTH)**:`);
  sections.push(`- AI Recommendation: ${analysis.recommendation} (Confidence: ${analysis.score}/100)`);
  if (analysis.summary) sections.push(`- Summary: ${analysis.summary}`);
  if (analysis.bullishCase) sections.push(`- Bullish Case: ${analysis.bullishCase}`);
  if (analysis.bearishCase) sections.push(`- Bearish Case: ${analysis.bearishCase}`);
  
  if (analysis.technicalAnalysis) sections.push(`- Technical Context: ${analysis.technicalAnalysis.slice(0, 1000)}`);
  if (analysis.fundamentalAnalysis) sections.push(`- Fundamental Context: ${analysis.fundamentalAnalysis.slice(0, 1000)}`);
  
  if (analysis.technicalIndicators) {
    sections.push(`- Real-time Technicals: MA20=${analysis.technicalIndicators.ma20}, Support=${analysis.technicalIndicators.supportShort}, Resistance=${analysis.technicalIndicators.resistanceShort}`);
  }

  if (analysis.extendedMarketData) {
    sections.push(`\n**[API Data] Deep Dimension Market Data**:`);
    if (analysis.extendedMarketData.lhb) sections.push(`- Dragon-Tiger List (LHB): ${JSON.stringify(analysis.extendedMarketData.lhb).slice(0, 1000)}`);
    if (analysis.extendedMarketData.margin) sections.push(`- Margin Trading: ${JSON.stringify(analysis.extendedMarketData.margin).slice(0, 800)}`);
    if (analysis.extendedMarketData.notices) sections.push(`- Announcements: ${JSON.stringify(analysis.extendedMarketData.notices).slice(0, 1000)}`);
    if (analysis.extendedMarketData.socialTrends) sections.push(`- Social Trends & Sentiment: ${JSON.stringify(analysis.extendedMarketData.socialTrends).slice(0, 1000)}`);
  }

  // 5. Discussion History (Previous Rounds)
  if (previousRounds && previousRounds.length > 0) {
    sections.push(isZh ? `\n**前轮专家分析 (PREVIOUS DISCUSSION)**:` : `\n**PREVIOUS DISCUSSION ROUNDS**:`);
    previousRounds.forEach(msg => {
      sections.push(`\n[${msg.role}]: ${msg.content}`);
    });
  }

  // Base output instruction
  sections.push(`\n**LANGUAGE**: MUST output in ${isZh ? 'Simplified Chinese (简体中文)' : 'English'}.`);

  return sections.join('\n');
}

function getRoleExamples(role: AgentRole, isZh: boolean): string | null {
  switch (role) {
    case 'Technical Analyst':
      return isZh ? TECHNICAL_ANALYST_EXAMPLES_ZH : TECHNICAL_ANALYST_EXAMPLES_EN;
    case 'Chief Strategist':
      return isZh ? CHIEF_STRATEGIST_EXAMPLES_ZH : CHIEF_STRATEGIST_EXAMPLES_EN;
    default:
      return null;
  }
}
