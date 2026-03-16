import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, X, Sparkles, Brain, MessageSquare, Loader2, TrendingUp, AlertTriangle } from 'lucide-react';
import { AIAnalysis, ChatMessage } from '../types';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';

interface AICoachProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: AIAnalysis | null;
  isAnalyzing: boolean;
  onRunAnalysis: () => void;
  chatHistory: ChatMessage[];
  isAsking: boolean;
  onAsk: (question: string) => void;
  onApplyAction: (action: any) => void;
}

export const AICoach: React.FC<AICoachProps> = ({
  isOpen,
  onClose,
  analysis,
  isAnalyzing,
  onRunAnalysis,
  chatHistory,
  isAsking,
  onAsk,
  onApplyAction
}) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, isAsking]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 duration-500 h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between bg-indigo-600 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Bot size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">AI Financial Coach</h2>
              <p className="text-[10px] text-indigo-200 uppercase font-bold tracking-widest">Powered by Provera AI</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-indigo-200 hover:bg-white/10 rounded-xl transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
          {/* Analysis Section */}
          {!analysis && !isAnalyzing ? (
            <div className="text-center py-12 space-y-4">
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-indigo-600">
                <Brain size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-zinc-900">Need a financial checkup?</h3>
                <p className="text-sm text-zinc-500 max-w-[240px] mx-auto">I can analyze your 12-week forecast and give you personalized advice.</p>
              </div>
              <button 
                onClick={onRunAnalysis}
                className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
              >
                Run Analysis
              </button>
            </div>
          ) : isAnalyzing ? (
            <div className="text-center py-12 space-y-4">
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-indigo-600 animate-pulse">
                <Sparkles size={40} />
              </div>
              <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Analyzing your data...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Health Summary */}
              <div className={cn(
                "p-6 rounded-3xl border",
                analysis?.healthStatus === 'Good' ? "bg-emerald-50 border-emerald-100" :
                analysis?.healthStatus === 'Moderate' ? "bg-amber-50 border-amber-100" :
                "bg-rose-50 border-rose-100"
              )}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Financial Health</span>
                  <span className={cn(
                    "text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
                    analysis?.healthStatus === 'Good' ? "bg-emerald-100 text-emerald-600" :
                    analysis?.healthStatus === 'Moderate' ? "bg-amber-100 text-amber-600" :
                    "bg-rose-100 text-rose-600"
                  )}>
                    {analysis?.healthStatus}
                  </span>
                </div>
                <p className="text-lg font-bold text-zinc-900 leading-tight">{analysis?.healthSummary}</p>
              </div>

              {/* Insights */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">Key Insights</h4>
                {analysis?.insights.map((insight, idx) => (
                  <div key={idx} className="flex gap-3 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      insight.type === 'risk' ? "bg-rose-100 text-rose-600" :
                      insight.type === 'suggestion' ? "bg-indigo-100 text-indigo-600" :
                      insight.type === 'impact' ? "bg-amber-100 text-amber-600" :
                      "bg-emerald-100 text-emerald-600"
                    )}>
                      {insight.type === 'risk' ? <AlertTriangle size={16} /> : 
                       insight.type === 'suggestion' ? <Sparkles size={16} /> :
                       insight.type === 'impact' ? <TrendingUp size={16} /> :
                       <MessageSquare size={16} />}
                    </div>
                    <div className="space-y-3 flex-1">
                      <p className="text-sm font-medium text-zinc-600 leading-relaxed">{insight.message}</p>
                      {insight.action && (
                        <button 
                          onClick={() => onApplyAction(insight.action)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-indigo-100 transition-colors"
                        >
                          <Sparkles size={12} /> {insight.action.label}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Suggestions */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">Action Plan</h4>
                <div className="space-y-2">
                  {analysis?.suggestions.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-white border border-zinc-100 rounded-xl">
                      <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                      <p className="text-xs font-bold text-zinc-700">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Chat History */}
          {chatHistory.length > 0 && (
            <div className="space-y-4 pt-6 border-t border-zinc-100">
              <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">Conversation</h4>
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={cn(
                  "flex",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}>
                  <div className={cn(
                    "max-w-[85%] p-4 rounded-2xl text-sm",
                    msg.role === 'user' ? "bg-zinc-900 text-white rounded-tr-none" : "bg-zinc-100 text-zinc-900 rounded-tl-none"
                  )}>
                    <div className="markdown-body prose prose-sm max-w-none prose-zinc">
                      <ReactMarkdown>
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              {isAsking && (
                <div className="flex justify-start">
                  <div className="bg-zinc-100 p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                    <Loader2 size={16} className="text-zinc-400 animate-spin" />
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Thinking...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-6 border-t border-zinc-100 bg-zinc-50">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim()) {
                onAsk(input);
                setInput('');
              }
            }}
            className="relative"
          >
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="w-full bg-white border border-zinc-200 rounded-2xl pl-6 pr-14 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-600 outline-none transition-all shadow-sm"
            />
            <button 
              type="submit"
              disabled={!input.trim() || isAsking}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:bg-zinc-400"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
