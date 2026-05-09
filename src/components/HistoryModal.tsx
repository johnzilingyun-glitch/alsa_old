import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Clock, BarChart3, ChevronRight, History as HistoryIcon, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getHistoryContext } from '../services/aiService';
import { generateHistoryItemKey } from '../services/dateUtils';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: any) => void;
}

export function HistoryModal({ isOpen, onClose, onSelect }: HistoryModalProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    getHistoryContext()
      .then(data => {
        if (!signal?.aborted) setHistory(data);
      })
      .catch(err => {
        if (!signal?.aborted) {
          console.error('Failed to load history:', err);
          setError('无法检索历史库，请稍后再试。');
        }
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (isOpen) {
      const controller = new AbortController();
      loadHistory(controller.signal);
      return () => controller.abort();
    }
  }, [isOpen, loadHistory]);

  const filteredHistory = history.filter(item => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    
    // Stock match
    const stockMatch = item.stockInfo?.symbol?.toLowerCase().includes(searchLower) ||
                       item.stockInfo?.name?.toLowerCase().includes(searchLower);
    
    // Market match
    const marketMatch = item.type === 'market' && (
      item.market?.toLowerCase().includes(searchLower) || 
      '市场研判'.toLowerCase().includes(searchLower) ||
      'Market Overview'.toLowerCase().includes(searchLower)
    );

    return stockMatch || marketMatch;
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-900/10 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/10 flex flex-col max-h-[85vh]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-modal-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 p-8">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/50">
                  <HistoryIcon size={24} strokeWidth={1.5} />
                </div>
                <div>
                  <h2 id="history-modal-title" className="text-xl font-bold text-zinc-950 tracking-tight">历史研判回顾</h2>
                  <p className="text-xs font-medium text-zinc-400 mt-0.5">Review your previous market analysis</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Search */}
            <div className="p-8 pb-4">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="搜索历史股票代码或名称..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-premium h-12 pl-12 pr-6"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-3 custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">正在检索历史库...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mb-2">
                    <X size={20} />
                  </div>
                  <p className="text-sm font-bold text-zinc-900">{error}</p>
                  <button 
                    onClick={() => loadHistory()}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                  >
                    <RefreshCw size={14} />
                    重试
                  </button>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="text-center py-20 text-zinc-400 space-y-4">
                  <BarChart3 size={40} className="mx-auto opacity-10" />
                  <div>
                    <p className="text-sm font-bold text-zinc-500 mb-1">
                      {searchTerm ? '未找到相关的研判记录' : '暂无分析记录'}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {searchTerm ? '请尝试其他关键词' : '搜索并分析股票后，历史记录将保存在这里'}
                    </p>
                  </div>
                  {!searchTerm && (
                    <button
                      onClick={onClose}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      <Search size={12} />
                      返回搜索第一只股票 →
                    </button>
                  )}
                </div>
              ) : (
                filteredHistory.map((item, idx) => {
                  const itemKey = generateHistoryItemKey(item, idx);
                  const isMarket = item.type === 'market' || (item.indices && !item.stockInfo);
                  const title = isMarket ? `${item.market || 'Market'} Overview` : item.stockInfo?.name;
                  const subtitle = isMarket ? '全周期市场研判报告' : item.stockInfo?.symbol;
                  
                  return (
                    <button
                      key={itemKey}
                      onClick={() => { onSelect(item); onClose(); }}
                      className="w-full flex items-center justify-between p-5 bg-white hover:bg-zinc-50 rounded-2xl transition-all border border-zinc-100 hover:border-zinc-200 group"
                    >
                      <div className="flex items-center gap-5">
                        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all ${
                          isMarket 
                            ? "bg-indigo-50 border-indigo-100 text-indigo-600" 
                            : "bg-zinc-50 border-zinc-100 text-zinc-400 group-hover:bg-white group-hover:text-indigo-600"
                        }`}>
                          <BarChart3 size={20} />
                        </div>
                        <div className="text-left">
                          <h4 className="font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors">
                            {title}
                            {isMarket && (
                              <span className="ml-2 text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-md uppercase tracking-tighter">
                                Market
                              </span>
                            )}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[10px] font-bold text-zinc-400 group-hover:text-zinc-500 transition-colors">{subtitle}</span>
                            {(item.discussion?.length > 0 || item.messages?.length > 0) && (
                              <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-[8px] font-black uppercase text-emerald-600 tracking-tighter">
                                多轮研判
                              </span>
                            )}
                            {item.chatHistory && item.chatHistory.length > 0 && (
                              <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-[8px] font-black uppercase text-indigo-600 tracking-tighter">
                                对话记录
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">Analysis Date</p>
                          <p className="text-xs font-semibold text-zinc-500">
                            {isMarket 
                              ? (item.generatedAt ? new Date(item.generatedAt).toLocaleDateString() : '--')
                              : (item.stockInfo?.lastUpdated?.split(' ')[0] || '--')
                            }
                          </p>
                        </div>
                        <ChevronRight size={16} className="text-zinc-300 group-hover:text-indigo-600 transition-all group-hover:translate-x-1" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            
            <div className="p-8 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                共有 {filteredHistory.length} 条研判记录
              </p>
              <button onClick={onClose} className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest hover:text-indigo-700">
                关闭视窗
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
