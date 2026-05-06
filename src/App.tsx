/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useCallback, Suspense, lazy } from 'react';
import { MarketOverview } from './components/dashboard/MarketOverview';
import { Header } from './components/layout/Header';
import { AnalysisResult } from './components/analysis/AnalysisResult';
import { AnalysisLoadingPulse } from './components/analysis/AnalysisLoadingPulse';
import { SettingsModal } from './components/SettingsModal';
import { HistoryModal } from './components/HistoryModal';
import { useAnalysisStore } from './stores/useAnalysisStore';
import { useUIStore } from './stores/useUIStore';
import { useMarketStore } from './stores/useMarketStore';
import { useConfigStore } from './stores/useConfigStore';
import { useDiscussionStore } from './stores/useDiscussionStore';
import { analyzeStock, sendChatMessage, getStockReport, getChatReport } from './services/analysisService';
import { getMarketOverview, getDailyReport } from './services/marketService';
import { sendAnalysisToFeishu } from './services/feishuService';
import { answerDiscussionQuestion, generateNewConclusion } from './services/discussionService';
import { getHistoryContext, getOptimizationLogs } from './services/adminService';
import { generateHtmlReport } from './utils/reportGenerator';
import { AgentDiscussion } from './types';
import { useI18nSync } from './hooks/useI18nSync';
import { useTranslation } from 'react-i18next';

const AdminPanel = lazy(() => import('./components/admin/AdminPanel').then(m => ({ default: m.AdminPanel })));

export default function App() {
  const { 
    analysis, setAnalysis, symbol, market, 
    setChatMessage, chatHistory, setChatHistory, resetAnalysis 
  } = useAnalysisStore();
  
  const { 
    setOverviewLoading, setOverviewError, setLoading, setAnalysisError,
    setIsSendingReport, setReportStatus,
    setIsTriggeringReport, setServiceStatus,
    isHistoryOpen, setIsHistoryOpen, setShowAdminPanel, showAdminPanel
  } = useUIStore();
  
  const { 
    setMarketOverview, setDailyReport: setMarketDailyReport,
    setHistoryItems, setOptimizationLogs
  } = useMarketStore();

  const { config, geminiConfig, feishuWebhookUrl, language } = useConfigStore();
  const { 
    setAnalysisStatus, analysisLevel, setIsDiscussing, setShowDiscussion
  } = useUIStore();
  const { 
    setDiscussionMessages, setDiscussionResults, resetDiscussion, setRoundProgress 
  } = useDiscussionStore();

  useI18nSync(); // Automatically translate analysis data on language switch
  const { i18n } = useTranslation();

  // Ensure i18n language matches store language on mount
  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  const handleFetchMarketOverview = useCallback(async (force = false) => {
    try {
      setOverviewLoading(true);
      setOverviewError(null);
      const data = await getMarketOverview(config || geminiConfig, market, force);
      setMarketOverview(market, data);
    } catch (err: any) {
      setOverviewError(err.message || 'Failed to fetch market overview');
      if (err.message?.includes('quota')) setServiceStatus('quota_exhausted');
    } finally {
      setOverviewLoading(false);
    }
  }, [market, config, geminiConfig, setOverviewLoading, setOverviewError, setMarketOverview, setServiceStatus]);

  useEffect(() => {
    handleFetchMarketOverview();
  }, [handleFetchMarketOverview]);

  const handleSearch = async (e?: React.FormEvent, explicitSymbol?: string) => {
    if (e) e.preventDefault();
    const query = (explicitSymbol || symbol || '').trim();
    if (!query) return;

    if (explicitSymbol && explicitSymbol !== symbol) {
      useAnalysisStore.getState().setSymbol(explicitSymbol);
    }

    try {
      setLoading(true);
      setAnalysisError(null);
      resetDiscussion();
      
      const result = await analyzeStock(
        query, 
        market, 
        config || geminiConfig,
        (status) => setAnalysisStatus(status)
      );
      setAnalysis(result);
      
      // Save analysis to history asynchronously
      import('./services/adminService').then(m => {
        m.saveAnalysisToHistory('stock', result);
      });

      // Handle multi-round discussion for Standard and Deep levels
      if (analysisLevel !== 'quick') {
        setIsDiscussing(true);
        setShowDiscussion(true); // Auto-open the discussion panel for better visibility
        try {
          // Dynamic import to avoid heavy bundle if not needed
          const { startMultiRoundDiscussion } = await import('./services/discussionService');
          const discussion = await startMultiRoundDiscussion(
            result, 
            analysisLevel, 
            config || geminiConfig,
            (progress) => {
              setRoundProgress(
                progress.currentRound, 
                progress.totalRounds, 
                progress.activeExperts, 
                progress.currentStep, 
                progress.lastReasoning
              );
              setDiscussionMessages(progress.messages);
            }
          );
          setDiscussionResults(discussion);
          
          // Construct and set final analysis with discussion integrated
          const finalAnalysis = { 
            ...result, 
            ...discussion,
            discussion: discussion.messages, // Store messages twice for compatibility? (the store uses discussionMessages)
            finalConclusion: discussion.finalConclusion || result.finalConclusion
          };
          setAnalysis(finalAnalysis);
          
          // Re-save to history now that we have the full discussion
          import('./services/adminService').then(m => {
            m.saveAnalysisToHistory('stock', finalAnalysis);
          });
        } catch (discErr) {
          console.error('Discussion stage failed:', discErr);
        } finally {
          setIsDiscussing(false);
        }
      }
    } catch (err: any) {
      const msg = err.message || 'Analysis failed';
      setAnalysisError(msg);
      if (msg.toLowerCase().includes('quota') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        setServiceStatus('quota_exhausted');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerDailyReport = async () => {
    try {
      setIsTriggeringReport(true);
      const overview = await getMarketOverview(config || geminiConfig, market, true);
      const report = await getDailyReport(overview, config || geminiConfig);
      setMarketDailyReport(report);
    } catch (err) {
      console.error('Failed to trigger daily report:', err);
    } finally {
      setIsTriggeringReport(false);
    }
  };

  const handleFetchAdminData = async () => {
    try {
      const [history, logs] = await Promise.all([
        getHistoryContext(),
        getOptimizationLogs()
      ]);
      setHistoryItems(history);
      setOptimizationLogs(logs);
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <Header 
        onSearch={handleSearch}
        onResetToHome={resetAnalysis}
        onTriggerDailyReport={handleTriggerDailyReport}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onFetchAdminData={handleFetchAdminData}
      />
      <main className="p-4 max-w-7xl mx-auto">
        {analysis ? (
          <AnalysisResult 
            onResetToHome={resetAnalysis}
            onExportFullReport={async () => {
              const htmlContent = generateHtmlReport(analysis, language);
              const blob = new Blob([htmlContent], { type: 'text/html' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${symbol}_Equity_Research_Report.html`;
              a.click();
            }}
            onSendStockReport={async () => {
              if (!feishuWebhookUrl) return;
              setIsSendingReport(true);
              setReportStatus('idle');
              try {
                const success = await sendAnalysisToFeishu(analysis, feishuWebhookUrl);
                setReportStatus(success ? 'success' : 'error');
              } catch {
                setReportStatus('error');
              } finally {
                setIsSendingReport(false);
              }
            }}
            onSendDiscussionReport={async () => {
              if (!feishuWebhookUrl) return;
              setIsSendingReport(true);
              try {
                const store = useDiscussionStore.getState();
                const discussion: AgentDiscussion = {
                  messages: store.discussionMessages,
                  controversialPoints: store.controversialPoints,
                  tradingPlanHistory: store.tradingPlanHistory,
                  analystWeights: store.analystWeights,
                  expectedValueOutcome: store.expectedValueOutcome,
                  sensitivityMatrix: store.sensitivityMatrix,
                  finalConclusion: analysis.finalConclusion || ''
                };
                await sendAnalysisToFeishu(analysis, feishuWebhookUrl, discussion);
              } finally {
                setIsSendingReport(false);
              }
            }}
            onSendChatReport={async () => {
              if (!feishuWebhookUrl) return;
              const report = await getChatReport(analysis.stockInfo?.name || symbol, chatHistory, config || geminiConfig);
              // Implementation for sending report...
            }}
            onDiscussionQuestion={async (question) => {
              const store = useDiscussionStore.getState();
              const result = await answerDiscussionQuestion(analysis, question, 'Chief Strategist', store.discussionMessages, config || geminiConfig);
              useDiscussionStore.getState().setDiscussionMessages(prev => [...prev, result]);
            }}
            onGenerateNewConclusion={async () => {
              const store = useDiscussionStore.getState();
              const result = await generateNewConclusion(analysis, store.discussionMessages, config || geminiConfig);
              useDiscussionStore.getState().setDiscussionResults({
                 messages: [...store.discussionMessages, result.message],
                 finalConclusion: result.finalConclusion
              } as any);
            }}
            onChat={async (message) => {
              if (!message || !analysis) return;
              setChatMessage('');
              const newUserMsg = { id: Date.now().toString(), role: 'user' as const, content: message };
              const updatedHistoryWithUser = [...chatHistory, newUserMsg];
              setChatHistory(updatedHistoryWithUser);

              try {
                const response = await sendChatMessage(message, analysis, config || geminiConfig);
                const newAiMsg = { id: (Date.now() + 1).toString(), role: 'ai' as const, content: response };
                const finalChatHistory = [...updatedHistoryWithUser, newAiMsg];
                setChatHistory(finalChatHistory);

                // Update analysis object and save to history
                const updatedAnalysis = { ...analysis, chatHistory: finalChatHistory };
                setAnalysis(updatedAnalysis);
                
                import('./services/adminService').then(m => {
                  m.saveAnalysisToHistory('stock', updatedAnalysis);
                });
              } catch (err) {
                const errorMsg = { id: (Date.now() + 1).toString(), role: 'ai' as const, content: 'Chat failed. Please try again.' };
                setChatHistory([...updatedHistoryWithUser, errorMsg]);
              }
            }}
          />
        ) : (
          <MarketOverview 
            onFetchMarketOverview={handleFetchMarketOverview}
            onTriggerDailyReport={handleTriggerDailyReport}
          />
        )}

        {showAdminPanel && (
          <Suspense fallback={null}>
            <AdminPanel />
          </Suspense>
        )}
      </main>

      <AnalysisLoadingPulse />

      <SettingsModal />
      <HistoryModal 
        isOpen={isHistoryOpen} 
        onClose={() => setIsHistoryOpen(false)}
        onSelect={(item) => {
          if (item.type === 'market' || (item.indices && !item.stockInfo)) {
            setMarketOverview(item.market || market, item);
            resetAnalysis();
            resetDiscussion();
          } else {
            setAnalysis(item);
            
            // Re-populate discussion store from history item
            if (item.discussion || item.messages) {
              const messages = item.discussion || item.messages;
              setDiscussionResults({
                messages,
                finalConclusion: item.finalConclusion,
                controversialPoints: item.controversialPoints,
                tradingPlanHistory: item.tradingPlanHistory,
                analystWeights: item.analystWeights,
                expectedValueOutcome: item.expectedValueOutcome,
                sensitivityMatrix: item.sensitivityMatrix,
                coreVariables: item.coreVariables,
                scenarios: item.scenarios,
                businessModel: item.businessModel,
                quantifiedRisks: item.quantifiedRisks,
                moatAnalysis: item.moatAnalysis,
                industryAnchors: item.industryAnchors,
                dataVerification: item.dataVerification,
              } as any);
              setShowDiscussion(true);
            } else {
              resetDiscussion();
              setShowDiscussion(false);
            }

            // Restore follow-up chat history
            if (item.chatHistory) {
              setChatHistory(item.chatHistory);
            } else {
              setChatHistory([]);
            }
          }
          setIsHistoryOpen(false);
        }}
      />
      <Suspense fallback={null}>
        {showAdminPanel && <AdminPanel />}
      </Suspense>
    </div>
  );
}
