import { StockAnalysis, Scenario, CoreVariable, QuantifiedRisk } from '../types';

export function generateHtmlReport(analysis: StockAnalysis, language: string = 'en'): string {
  const isZh = language === 'zh-CN';
  
  const title = isZh ? `${analysis.stockInfo.name} (${analysis.stockInfo.symbol}) 深度研报` : `${analysis.stockInfo.name} (${analysis.stockInfo.symbol}) Equity Research Report`;
  
  const dateStr = new Date().toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  const price = analysis.stockInfo.price?.toFixed(2) || 'N/A';
  const currency = analysis.stockInfo.currency || '';
  const changePercent = analysis.stockInfo.changePercent?.toFixed(2) + '%' || 'N/A';
  const changeColor = (analysis.stockInfo.changePercent || 0) >= 0 ? '#10b981' : '#ef4444';
  const changeSign = (analysis.stockInfo.changePercent || 0) >= 0 ? '+' : '';

  const recColors: Record<string, string> = {
    'Buy': '#10b981',
    'Overweight': '#34d399',
    'Hold': '#f59e0b',
    'Underweight': '#f87171',
    'Sell': '#ef4444'
  };
  const recommendationColor = recColors[analysis.recommendation] || '#64748b';

  const formatText = (text?: string) => {
    if (!text) return '';
    return text
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  };

  const renderSection = (title: string, content?: string) => {
    if (!content || content.trim() === '') return '';
    return `
      <div class="section">
        <h2 class="section-title">${title}</h2>
        <div class="content"><p>${formatText(content)}</p></div>
      </div>
    `;
  };

  const renderList = (title: string, items?: string[]) => {
    if (!items || items.length === 0) return '';
    return `
      <div class="section">
        <h2 class="section-title">${title}</h2>
        <ul class="styled-list">
          ${items.map(item => `<li>${formatText(item)}</li>`).join('')}
        </ul>
      </div>
    `;
  };

  const renderScenarios = (scenarios?: Scenario[]) => {
    if (!scenarios || scenarios.length === 0) return '';
    return `
      <div class="section">
        <h2 class="section-title">${isZh ? '情景分析与演练 (Scenario Analysis)' : 'Scenario Analysis'}</h2>
        <table class="data-table">
          <thead>
            <tr>
              <th>${isZh ? '情景' : 'Case'}</th>
              <th>${isZh ? '概率' : 'Probability'}</th>
              <th>${isZh ? '独立目标价' : 'Target Price'}</th>
              <th>${isZh ? '核心驱动假设' : 'Key Inputs'}</th>
            </tr>
          </thead>
          <tbody>
            ${scenarios.map(s => `
              <tr>
                <td><strong>${s.case}</strong></td>
                <td>${s.probability}%</td>
                <td><strong>${s.targetPrice || '-'}</strong></td>
                <td>${formatText(s.keyInputs)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  const renderCoreVariables = (vars?: CoreVariable[]) => {
    if (!vars || vars.length === 0) return '';
    return `
      <div class="section">
        <h2 class="section-title">${isZh ? '核心博弈变量 (Core Variables)' : 'Core Variables'}</h2>
        <div class="grid-2">
          ${vars.map(v => `
            <div class="card">
              <div class="card-title">${v.name} <span class="badge" style="background: #1e293b; color: white;">${v.evidenceLevel}</span></div>
              <p style="margin: 8px 0 0 0; font-size: 13px;"><strong>${isZh ? '当前状态' : 'Current'}:</strong> ${v.value} ${v.unit}</p>
              <p style="margin: 4px 0 0 0; font-size: 13px;"><strong>${isZh ? '预期差' : 'Expectation Gap'}:</strong> ${v.delta} - ${v.reason}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  };

  const renderTradingPlan = () => {
    if (!analysis.tradingPlan) return '';
    const tp = analysis.tradingPlan;
    return `
      <div class="section">
        <h2 class="section-title">${isZh ? '交易操作计划 (Trading Plan)' : 'Trading Plan'}</h2>
        <div class="grid-3" style="margin-bottom: 15px;">
          <div class="metric-box" style="border-left: 4px solid #3b82f6;">
            <div class="metric-label">${isZh ? '建仓均价区间' : 'Entry Price Range'}</div>
            <div class="metric-value">${tp.entryPrice || 'N/A'}</div>
          </div>
          <div class="metric-box" style="border-left: 4px solid #10b981;">
            <div class="metric-label">${isZh ? '复合目标价' : 'Target Price'}</div>
            <div class="metric-value">${tp.targetPrice || 'N/A'}</div>
          </div>
          <div class="metric-box" style="border-left: 4px solid #ef4444;">
            <div class="metric-label">${isZh ? '绝对止损价位' : 'Stop Loss Threshold'}</div>
            <div class="metric-value">${tp.stopLoss || 'N/A'}</div>
          </div>
        </div>
        <div class="content"><p><strong>${isZh ? '系统性执行策略' : 'Execution Strategy'}:</strong> ${formatText(tp.strategy)}</p></div>
        ${tp.logicBasedStopLoss ? `<div class="content" style="margin-top: 10px;"><p><strong>${isZh ? '基本面逻辑证伪止损' : 'Logic-based Stop'}:</strong> ${formatText(tp.logicBasedStopLoss)}</p></div>` : ''}
        ${tp.strategyRisks ? `
          <div style="margin-top: 15px; padding: 12px; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px;">
            <strong style="color: #991b1b; display: block; margin-bottom: 5px;">${isZh ? '策略核心失效风险预警' : 'Critical Execution Risks'}:</strong>
            <div style="color: #991b1b; font-size: 14px;">${formatText(tp.strategyRisks)}</div>
          </div>
        ` : ''}
      </div>
    `;
  };

  return `<!DOCTYPE html>
<html lang="${isZh ? 'zh-CN' : 'en'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        :root {
            --primary-color: #0f172a;
            --secondary-color: #3b82f6;
            --accent-color: #f59e0b;
            --text-main: #334155;
            --text-light: #64748b;
            --bg-light: #f8fafc;
            --border: #e2e8f0;
            --font-main: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            --font-serif: Georgia, Cambria, "Times New Roman", Times, serif;
        }

        * { box-sizing: border-box; }
        
        body {
            font-family: var(--font-main);
            color: var(--text-main);
            line-height: 1.6;
            margin: 0;
            padding: 0;
            background-color: #e2e8f0;
            -webkit-print-color-adjust: exact;
        }

        .container {
            max-width: 950px;
            margin: 40px auto;
            background: #fff;
            box-shadow: 0 10px 30px rgba(0,0,0,0.08);
            border-radius: 8px;
            overflow: hidden;
        }

        /* Cover & Header */
        .header-cover {
            background-color: var(--primary-color);
            color: #fff;
            padding: 40px 50px;
            position: relative;
        }

        .system-branding {
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #94a3b8;
            margin-bottom: 25px;
            display: inline-block;
            border-bottom: 1px solid #94a3b8;
            padding-bottom: 4px;
        }

        .report-title {
            font-family: var(--font-serif);
            font-size: 36px;
            font-weight: 700;
            margin: 0 0 10px 0;
            line-height: 1.2;
        }

        .report-subtitle {
            font-size: 16px;
            color: #cbd5e1;
            margin-bottom: 30px;
        }

        .snapshot-bar {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 8px;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .snapshot-price .price {
            font-size: 32px;
            font-weight: bold;
            font-family: var(--font-main);
        }

        .snapshot-price .change {
            font-size: 16px;
            font-weight: 600;
            margin-left: 10px;
            padding: 2px 8px;
            border-radius: 4px;
            background-color: ${changeColor};
            color: #fff;
        }

        .badge-rating {
            background-color: ${recommendationColor};
            color: #fff;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .snapshot-info {
            display: flex;
            gap: 20px;
            margin-top: 15px;
            font-size: 13px;
            color: rgba(255, 255, 255, 0.7);
        }

        /* Body Content */
        .report-body {
            padding: 40px 50px;
        }

        .section {
            margin-bottom: 40px;
        }

        .section-title {
            font-family: var(--font-serif);
            color: var(--primary-color);
            border-bottom: 2px solid var(--primary-color);
            padding-bottom: 8px;
            font-size: 22px;
            margin-bottom: 20px;
            margin-top: 0;
            letter-spacing: 0.5px;
        }

        .content {
            font-size: 15px;
            color: #475569;
        }
        
        .content p {
            margin-top: 0;
            margin-bottom: 1em;
            text-align: justify;
        }

        /* Components */
        .styled-list {
            padding-left: 20px;
            margin: 0;
            color: #475569;
        }
        
        .styled-list li {
            margin-bottom: 8px;
            padding-left: 5px;
        }

        .metric-box {
            background: var(--bg-light);
            padding: 15px 20px;
            border-radius: 6px;
            border: 1px solid var(--border);
        }

        .metric-label {
            font-size: 11px;
            color: var(--text-light);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 6px;
        }

        .metric-value {
            font-size: 18px;
            font-weight: 700;
            color: var(--primary-color);
        }

        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }

        .data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }

        .data-table th, .data-table td {
            border: 1px solid var(--border);
            padding: 12px 15px;
            text-align: left;
            vertical-align: top;
        }

        .data-table th {
            background-color: var(--bg-light);
            color: var(--primary-color);
            font-weight: 600;
            font-size: 13px;
        }
        
        .data-table tr:nth-child(even) {
            background-color: #f8fafc;
        }

        .card {
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 15px;
            background: #fff;
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
            border-top: 3px solid var(--secondary-color);
        }
        
        .card-title {
            font-weight: 600;
            font-size: 15px;
            color: var(--primary-color);
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .badge {
            font-size: 11px;
            padding: 3px 8px;
            border-radius: 4px;
            font-weight: 600;
        }

        .highlight-box {
            background: #eff6ff;
            border-left: 4px solid var(--secondary-color);
            padding: 25px;
            border-radius: 0 8px 8px 0;
            margin-bottom: 35px;
        }

        .score-box {
            display: inline-flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #1e293b;
            color: #fff;
            border-radius: 8px;
            padding: 15px 25px;
            margin-right: 20px;
        }

        .score-box .score-num {
            font-size: 28px;
            font-weight: bold;
            font-family: var(--font-serif);
        }

        .score-box .score-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #94a3b8;
        }

        .footer {
            background-color: #0f172a;
            color: #94a3b8;
            padding: 40px 50px;
            font-size: 12px;
            text-align: center;
            border-top: 4px solid var(--secondary-color);
        }

        /* Print Media Queries */
        @media print {
            body { background: #fff; }
            .container { box-shadow: none; margin: 0; max-width: 100%; border-radius: 0; padding: 0; }
            .header-cover { -webkit-print-color-adjust: exact; background-color: #0f172a !important; padding: 30px; }
            .snapshot-bar { border: 1px solid #334155 !important; }
            .badge-rating { -webkit-print-color-adjust: exact; }
            .highlight-box { background-color: #eff6ff !important; -webkit-print-color-adjust: exact; }
            .report-body { padding: 30px; }
            .page-break { page-break-before: always; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header-cover">
            <div class="system-branding">Nexus Multi-Agent AI Equity Research</div>
            <h1 class="report-title">${analysis.stockInfo.name}</h1>
            <div class="report-subtitle">${analysis.stockInfo.symbol} | ${dateStr}</div>
            
            <div class="snapshot-bar">
                <div class="snapshot-price">
                    <span class="price">${currency} ${price}</span>
                    <span class="change">${changeSign}${changePercent}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 20px;">
                    <div class="score-box" style="padding: 10px 20px; margin: 0;">
                        <div class="score-num">${Math.round(analysis.score || 50)}</div>
                        <div class="score-label">${isZh ? '综评得分' : 'AI Score'}</div>
                    </div>
                    <div class="snapshot-rating">
                        <span class="badge-rating">${analysis.recommendation}</span>
                    </div>
                </div>
            </div>
            
            <div class="snapshot-info">
                <span>Volume: ${analysis.stockInfo.volume ? (analysis.stockInfo.volume / 1000000).toFixed(2) + 'M' : 'N/A'}</span>
                <span>Currency: ${currency}</span>
            </div>
            
            ${analysis.stockInfo.lastUpdated ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 15px; text-align: right; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">Data as of ${new Date(analysis.stockInfo.lastUpdated).toUTCString()}</div>` : ''}
        </div>

        <div class="report-body">
            
            <div class="highlight-box">
                <h3 style="margin-top: 0; color: var(--secondary-color); font-family: var(--font-serif); font-size: 20px; margin-bottom: 15px;">${isZh ? '核心投研摘要 (Executive Summary)' : 'Executive Summary'}</h3>
                <div class="content" style="color: #1e293b; font-size: 15px;">
                    ${formatText(analysis.summary)}
                </div>
            </div>

            ${analysis.fundamentals ? `
              <div class="section">
                <h2 class="section-title">${isZh ? '核心财务指标与估值 (Key Financials & Valuation)' : 'Key Financials & Valuation'}</h2>
                <div class="grid-4" style="margin-bottom: 20px;">
                  <div class="metric-box">
                    <div class="metric-label">${isZh ? '总市值' : 'Market Cap'}</div>
                    <div class="metric-value">${analysis.fundamentals.marketCap || analysis.stockInfo.marketCap || '-'}</div>
                  </div>
                  <div class="metric-box">
                    <div class="metric-label">${isZh ? '市盈率 (PE)' : 'P/E'}</div>
                    <div class="metric-value">${analysis.fundamentals.pe || analysis.stockInfo.pe || '-'}</div>
                  </div>
                  <div class="metric-box">
                    <div class="metric-label">${isZh ? '市净率' : 'P/B'}</div>
                    <div class="metric-value">${analysis.fundamentals.pb || analysis.stockInfo.pb || '-'}</div>
                  </div>
                  <div class="metric-box">
                    <div class="metric-label">${isZh ? '净资产收益率' : 'ROE'}</div>
                    <div class="metric-value">${analysis.fundamentals.roe || (analysis.stockInfo.roe ? (analysis.stockInfo.roe * 100).toFixed(2) + '%' : '-')}</div>
                  </div>
                </div>
              </div>
            ` : ''}

            ${renderSection(isZh ? '研讨会最终结论与定盘 (Seminar Final Conclusion)' : 'Seminar Final Conclusion', analysis.finalConclusion)}
            
            ${renderCoreVariables(analysis.coreVariables)}
            
            ${renderScenarios(analysis.scenarios)}
            
            <div class="grid-2">
              ${renderList(isZh ? '核心驱动引擎 (Key Growth Opportunities)' : 'Key Growth Opportunities', analysis.keyOpportunities)}
              ${renderList(isZh ? '深度风险扫描 (Structural Risks)' : 'Structural Risks', analysis.keyRisks)}
            </div>

            ${analysis.quantifiedRisks && analysis.quantifiedRisks.length > 0 ? `
              <div class="section">
                <h2 class="section-title">${isZh ? '量化尾部风险 (Quantified Tail Risks)' : 'Quantified Tail Risks'}</h2>
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>${isZh ? '黑天鹅事件' : 'Risk Event'}</th>
                      <th>${isZh ? '潜在跌幅' : 'Expected Loss'}</th>
                      <th>${isZh ? '触发概率' : 'Probability'}</th>
                      <th>${isZh ? '对冲方案' : 'Mitigation'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${analysis.quantifiedRisks.map(r => `
                      <tr>
                        <td><strong>${r.name}</strong></td>
                        <td style="color: #ef4444; font-weight: bold;">${r.expectedLoss}%</td>
                        <td>${r.probability}%</td>
                        <td>${r.mitigation}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}

            <div class="page-break"></div>

            ${renderSection(isZh ? '基本面护城河深度解析 (Fundamental & Moat Analysis)' : 'Fundamental & Moat Analysis', analysis.fundamentalAnalysis)}
            
            ${renderSection(isZh ? '宏观与资金技术面剖析 (Technical & Macro Analysis)' : 'Technical & Macro Analysis', analysis.technicalAnalysis)}
            
            ${renderTradingPlan()}

            ${analysis.news && analysis.news.length > 0 ? `
              <div class="section">
                <h2 class="section-title">${isZh ? '近期催化剂、情绪池与研报跟踪 (Recent Catalysts & News Flow)' : 'Recent Catalysts & News Flow'}</h2>
                <ul class="styled-list">
                  ${analysis.news.map(n => `
                    <li style="margin-bottom: 15px; border-bottom: 1px dashed var(--border); padding-bottom: 10px;">
                      <div style="font-weight: 600; color: #1e293b; font-size: 15px;">${n.title}</div>
                      ${n.summary ? `<div style="font-size: 13px; color: #64748b; margin-top: 6px;">${n.summary}</div>` : ''}
                      <div style="font-size: 11px; color: #94a3b8; margin-top: 8px; text-transform: uppercase;">
                        <strong>${n.source || 'Aggregated News'}</strong> | ${n.time}
                      </div>
                    </li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}
            
        </div>

        <div class="footer">
            <p style="margin: 0 0 10px 0; font-size: 15px; font-weight: bold; color: #cbd5e1;">Generated by Nexus Multimodal AI Equities Oracle</p>
            <p style="margin: 0; line-height: 1.6; color: #64748b; font-size: 11px;">
              <strong>Disclaimer / 免责声明:</strong> This comprehensive equity research report is generated entirely by Autonomous AI Expert Agents acting under the Nexus framework. All models, scenario analyses, target prices, and recommendations are based on algorithmic interpretations of available market data and LLM logic synthesis. The information presented does not constitute professional investment advice. All investments carry significant risk; always conduct your own due diligence before executing trading plans.<br>
              本深度研究报告完全由基于 Nexus 框架的 Autonomous AI 专家代理矩阵生成。所有的量化模型、情景推导、复合目标价位及交易评级均来源于基础数据的算法挖掘与大语言模型(LLM)的逻辑推演定论。报告所呈信息仅供交流参考，并不构成对任何个股的投资邀约或专业建议。金融市场变幻莫测，任何投资均伴随高风险特性，请于执行实盘操作前独立进行尽职调查。
            </p>
        </div>
    </div>
</body>
</html>`;
}
