import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Calendar, 
  Settings as SettingsIcon, 
  Plus, 
  Trash2, 
  Edit2,
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight,
  Wallet,
  ChevronRight,
  Info,
  Users,
  User,
  X,
  Save,
  Bell,
  TrendingUp,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  ArrowRight,
  PieChart,
  Target,
  Sparkles,
  MessageSquare,
  Brain,
  Bot,
  Send,
  Loader2
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { 
  format, 
  addWeeks, 
  startOfWeek, 
  endOfWeek, 
  isWithinInterval, 
  parseISO, 
  getDate, 
  getMonth, 
  getYear,
  eachDayOfInterval,
  isSameDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppSettings, Income, FixedExpense, FutureEvent, ForecastWeek, SimulationState, AIAnalysis, ChatMessage, FinancialGoal, Movement } from './types';
import { generateFinancialAnalysis, askFinancialQuestion } from './services/aiService';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY = 'CHF';

type Tab = 'forecast' | 'setup' | 'events' | 'goals';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('forecast');
  const [settings, setSettings] = useState<AppSettings>({
    current_balance: 0,
    weekly_spending_estimate: 0,
    safety_threshold: 1000,
    is_couple_mode: true
  });
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [events, setEvents] = useState<FutureEvent[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'income' | 'expense' | 'event' | 'goal'>('income');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isSimPanelOpen, setIsSimPanelOpen] = useState(false);
  const [simulation, setSimulation] = useState<SimulationState>({
    isActive: false,
    weeklySpendingDelta: 0,
    oneOffExpenses: [],
    incomeChanges: []
  });

  // AI State
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [aiAnalysis, setAIAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [selectedWeek, setSelectedWeek] = useState<ForecastWeek | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsModalType, setSettingsModalType] = useState<'balance' | 'spending' | 'threshold'>('balance');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [sRes, iRes, feRes, eRes, gRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/incomes'),
        fetch('/api/fixed-expenses'),
        fetch('/api/events'),
        fetch('/api/goals')
      ]);
      
      const [sData, iData, feData, eData, gData] = await Promise.all([
        sRes.json(),
        iRes.json(),
        feRes.json(),
        eRes.json(),
        gRes.json()
      ]);

      setSettings({
        ...sData,
        is_couple_mode: !!sData.is_couple_mode
      });
      setIncomes(iData);
      setFixedExpenses(feData);
      setEvents(eData);
      setGoals(gData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAIAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const analysis = await generateFinancialAnalysis({
        settings,
        incomes,
        fixedExpenses,
        events,
        forecast,
        simulation,
        goals
      });
      setAIAnalysis(analysis);
    } catch (error) {
      console.error('AI Analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAskAI = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isAsking) return;

    const userMessage: ChatMessage = { role: 'user', text: chatInput };
    setChatHistory(prev => [...prev, userMessage]);
    setChatInput('');
    setIsAsking(true);

    try {
      const response = await askFinancialQuestion(chatInput, {
        settings,
        incomes,
        fixedExpenses,
        events,
        forecast,
        simulation
      }, chatHistory);
      
      const modelMessage: ChatMessage = { role: 'model', text: response };
      setChatHistory(prev => [...prev, modelMessage]);
    } catch (error) {
      console.error('AI Chat error:', error);
    } finally {
      setIsAsking(false);
    }
  };

  const handleSaveSettings = async (newSettings: AppSettings) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const forecast = useMemo(() => {
    const result: ForecastWeek[] = [];
    let runningBalance = settings.current_balance;
    let runningSimBalance = settings.current_balance;
    const today = new Date();
    
    for (let i = 0; i < 12; i++) {
      const weekStart = addWeeks(startOfWeek(today), i);
      const weekEnd = endOfWeek(weekStart);
      const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
      
      const weekIncomes: string[] = [];
      const weekEvents: string[] = [];
      const movements: Movement[] = [];
      const startBalance = runningBalance;
      
      let weekIncomeTotal = 0;
      let weekExpenseTotal = 0;
      
      let weekSimIncomeTotal = 0;
      let weekSimExpenseTotal = 0;

      // Weekly spending estimate
      weekExpenseTotal += settings.weekly_spending_estimate;
      weekSimExpenseTotal += settings.weekly_spending_estimate + simulation.weeklySpendingDelta;
      
      movements.push({
        name: 'Gasto semanal estimado',
        amount: simulation.isActive 
          ? settings.weekly_spending_estimate + simulation.weeklySpendingDelta
          : settings.weekly_spending_estimate,
        type: 'spending'
      });

      // Check incomes and fixed expenses for each day of the week
      weekDays.forEach(day => {
        const dayNum = getDate(day);
        
        incomes.forEach(inc => {
          if (inc.day_of_month === dayNum) {
            weekIncomeTotal += inc.amount;
            weekSimIncomeTotal += inc.amount;
            weekIncomes.push(`${inc.name} (${inc.amount})`);
            movements.push({
              name: inc.name,
              amount: inc.amount,
              type: 'income'
            });
          }
        });

        fixedExpenses.forEach(exp => {
          if (exp.day_of_month === dayNum) {
            weekExpenseTotal += exp.amount;
            weekSimExpenseTotal += exp.amount;
            weekEvents.push(`${exp.name} (-${exp.amount})`);
            movements.push({
              name: exp.name,
              amount: exp.amount,
              type: 'expense'
            });
          }
        });
      });

      // Check one-off events
      events.forEach(evt => {
        const evtDate = parseISO(evt.date);
        if (isWithinInterval(evtDate, { start: weekStart, end: weekEnd })) {
          weekExpenseTotal += evt.amount;
          weekSimExpenseTotal += evt.amount;
          weekEvents.push(`${evt.description} (-${evt.amount})`);
          movements.push({
            name: evt.description,
            amount: evt.amount,
            type: 'event'
          });
        }
      });

      // Simulation: One-off expenses
      simulation.oneOffExpenses.forEach(evt => {
        const evtDate = parseISO(evt.date);
        if (isWithinInterval(evtDate, { start: weekStart, end: weekEnd })) {
          weekSimExpenseTotal += evt.amount;
          if (simulation.isActive) {
            movements.push({
              name: `(Sim) ${evt.description}`,
              amount: evt.amount,
              type: 'event'
            });
          }
        }
      });

      // Simulation: Income changes
      simulation.incomeChanges.forEach(inc => {
        const incDate = parseISO(inc.date);
        if (isWithinInterval(incDate, { start: weekStart, end: weekEnd })) {
          weekSimIncomeTotal += inc.amount;
          if (simulation.isActive) {
            movements.push({
              name: `(Sim) ${inc.description}`,
              amount: inc.amount,
              type: 'income'
            });
          }
        }
      });

      runningBalance = runningBalance + weekIncomeTotal - weekExpenseTotal;
      runningSimBalance = runningSimBalance + weekSimIncomeTotal - weekSimExpenseTotal;

      result.push({
        week_number: i + 1,
        start_date: format(weekStart, 'dd/MM'),
        end_date: format(weekEnd, 'dd/MM'),
        start_balance: startBalance,
        projected_balance: runningBalance,
        simulated_balance: runningSimBalance,
        is_below_threshold: runningBalance < settings.safety_threshold,
        is_sim_below_threshold: runningSimBalance < settings.safety_threshold,
        events: weekEvents,
        incomes: weekIncomes,
        movements: movements
      });
    }
    return result;
  }, [settings, incomes, fixedExpenses, events, simulation]);

  const monthlySummary = useMemo(() => {
    const totalIncome = incomes.reduce((sum, inc) => sum + inc.amount, 0);
    const totalFixed = fixedExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const monthlyVariable = settings.weekly_spending_estimate * 4.33;
    
    const today = new Date();
    const currentMonth = getMonth(today);
    const currentYear = getYear(today);
    
    const extraEvents = events.filter(evt => {
      const d = parseISO(evt.date);
      return getMonth(d) === currentMonth && getYear(d) === currentYear;
    }).reduce((sum, evt) => sum + evt.amount, 0);
    
    const projectedRemaining = totalIncome - totalFixed - monthlyVariable - extraEvents;
    
    return {
      totalIncome,
      totalFixed,
      monthlyVariable,
      extraEvents,
      projectedRemaining
    };
  }, [incomes, fixedExpenses, settings, events]);

  const smartAlerts = useMemo(() => {
    const alerts: { type: 'warning' | 'info' | 'success' | 'danger'; message: string; icon: any }[] = [];
    
    // 1. Balance below limit
    const firstWeekBelow = forecast.find(w => w.is_below_threshold);
    if (firstWeekBelow) {
      alerts.push({
        type: 'danger',
        message: `Atenção: saldo abaixo do limite na semana ${firstWeekBelow.week_number}`,
        icon: AlertTriangle
      });
    } else {
      alerts.push({
        type: 'success',
        message: "Boa notícia: saldo estável nas próximas 12 semanas",
        icon: CheckCircle2
      });
    }

    // 2. Large expense approaching (next 7 days)
    const today = new Date();
    const largeExpense = events.find(evt => {
      const d = parseISO(evt.date);
      const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7 && evt.amount > 500;
    });
    if (largeExpense) {
      const diff = Math.ceil((parseISO(largeExpense.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      alerts.push({
        type: 'warning',
        message: `Despesa grande (${formatCurrency(largeExpense.amount)}) a aproximar-se em ${diff} dias`,
        icon: Bell
      });
    }

    // 3. Simulation risk
    if (simulation.isActive) {
      const simBelow = forecast.some(w => w.is_sim_below_threshold && !w.is_below_threshold);
      if (simBelow) {
        alerts.push({
          type: 'warning',
          message: "Simulação aumenta o risco financeiro",
          icon: TrendingDown
        });
      }
    }

    return alerts;
  }, [forecast, events, simulation, settings]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: CURRENCY,
    }).format(value);
  };

  const handleAddItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: any = Object.fromEntries(formData.entries());
    if (data.amount) data.amount = Number(data.amount);
    if (data.day_of_month) data.day_of_month = Number(data.day_of_month);
    if (data.target_amount) data.target_amount = Number(data.target_amount);
    if (data.is_completed !== undefined) data.is_completed = data.is_completed === 'on';

    let endpoint = '';
    if (modalType === 'income') endpoint = '/api/incomes';
    else if (modalType === 'expense') endpoint = '/api/fixed-expenses';
    else if (modalType === 'goal') endpoint = '/api/goals';
    else endpoint = '/api/events';

    if (editingItem) {
      endpoint += `/${editingItem.id}`;
    }

    try {
      await fetch(endpoint, {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      fetchData();
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving item:', error);
    }
  };

  const handleEdit = (type: 'income' | 'expense' | 'event' | 'goal', item: any) => {
    setModalType(type);
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (type: 'income' | 'expense' | 'event' | 'goal', id: number) => {
    let endpoint = '';
    if (type === 'income') endpoint = `/api/incomes/${id}`;
    else if (type === 'expense') endpoint = `/api/fixed-expenses/${id}`;
    else if (type === 'goal') endpoint = `/api/goals/${id}`;
    else endpoint = `/api/events/${id}`;

    try {
      await fetch(endpoint, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleUpdateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      const updated = { ...settings, ...newSettings };
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      setSettings(updated);
      setIsSettingsModalOpen(false);
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen">Carregando...</div>;

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white">
              <Wallet size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none">Fluxo Futuro</h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Previsão de Saldo</p>
            </div>
          </div>
          <button className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors relative">
            <Bell size={20} />
            {forecast.some(w => w.is_below_threshold) && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-6 space-y-6">
        {activeTab === 'forecast' && (
          <>
            {/* Simulation Active Banner */}
            {simulation.isActive && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-amber-600" />
                  <span className="text-xs font-bold text-amber-900">Modo Simulação Ativo</span>
                </div>
                <button 
                  onClick={() => setSimulation(s => ({ ...s, isActive: false }))}
                  className="text-[10px] font-bold text-amber-600 uppercase hover:text-amber-700"
                >
                  Desativar
                </button>
              </div>
            )}

            {/* Current Balance Card */}
            <div className="bg-zinc-900 rounded-3xl p-6 text-white shadow-xl shadow-zinc-200 overflow-hidden relative">
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Saldo Atual</p>
                  <button 
                    onClick={() => {
                      setSettingsModalType('threshold');
                      setIsSettingsModalOpen(true);
                    }}
                    className="bg-white/10 px-2 py-1 rounded-lg flex items-center gap-1.5 hover:bg-white/20 transition-colors"
                  >
                    <Target size={12} className="text-zinc-400" />
                    <span className="text-[10px] font-bold uppercase text-zinc-300">Meta: {formatCurrency(settings.safety_threshold)}</span>
                  </button>
                </div>
                <h2 
                  onClick={() => {
                    setSettingsModalType('balance');
                    setIsSettingsModalOpen(true);
                  }}
                  className="text-4xl font-bold mt-2 tracking-tight cursor-pointer hover:text-zinc-300 transition-colors"
                >
                  {formatCurrency(settings.current_balance)}
                </h2>
                
                <div className="mt-8 grid grid-cols-2 gap-3">
                  <div 
                    onClick={() => {
                      setSettingsModalType('spending');
                      setIsSettingsModalOpen(true);
                    }}
                    className="bg-white/5 rounded-2xl p-3 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                  >
                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Gasto Semanal</p>
                    <p className="text-sm font-bold">{formatCurrency(settings.weekly_spending_estimate)}</p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Status 12 Sem.</p>
                    <div className="flex items-center gap-1.5">
                      {forecast.some(w => w.is_below_threshold) ? (
                        <>
                          <AlertTriangle size={14} className="text-rose-500" />
                          <span className="text-sm font-bold text-rose-500">Risco</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={14} className="text-emerald-500" />
                          <span className="text-sm font-bold text-emerald-500">Seguro</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/5 rounded-full blur-3xl"></div>
            </div>

            {/* Smart Alerts */}
            <div className="space-y-2">
              {smartAlerts.map((alert, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "rounded-2xl p-4 flex items-center gap-3 border animate-in slide-in-from-left duration-300",
                    alert.type === 'danger' && "bg-rose-50 border-rose-100 text-rose-900",
                    alert.type === 'warning' && "bg-amber-50 border-amber-100 text-amber-900",
                    alert.type === 'success' && "bg-emerald-50 border-emerald-100 text-emerald-900",
                    alert.type === 'info' && "bg-blue-50 border-blue-100 text-blue-900"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                    alert.type === 'danger' && "bg-rose-100 text-rose-600",
                    alert.type === 'warning' && "bg-amber-100 text-amber-600",
                    alert.type === 'success' && "bg-emerald-100 text-emerald-600",
                    alert.type === 'info' && "bg-blue-100 text-blue-600"
                  )}>
                    <alert.icon size={18} />
                  </div>
                  <p className="text-xs font-bold leading-tight">{alert.message}</p>
                </div>
              ))}
            </div>

            {/* AI Advisor Entry Card */}
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-6 text-white shadow-xl shadow-indigo-100 overflow-hidden relative group cursor-pointer" onClick={() => { setIsAIPanelOpen(true); if (!aiAnalysis) handleRunAIAnalysis(); }}>
              <div className="relative z-10 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-indigo-200" />
                    <h3 className="text-xs font-bold text-indigo-100 uppercase tracking-widest">Assistente AI</h3>
                  </div>
                  <h2 className="text-xl font-black tracking-tight">AI Insights</h2>
                  <p className="text-[10px] text-indigo-200 font-medium max-w-[180px]">Receba recomendações inteligentes baseadas nos seus dados.</p>
                </div>
                <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md group-hover:scale-110 transition-transform">
                  <Brain size={32} className="text-white" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsAIPanelOpen(true); if (!aiAnalysis) handleRunAIAnalysis(); }}
                  className="bg-white text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-indigo-900/20 hover:bg-indigo-50 transition-colors"
                >
                  Analisar
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsAIPanelOpen(true); }}
                  className="bg-indigo-500/30 text-white border border-white/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-500/40 transition-colors flex items-center gap-1.5"
                >
                  <MessageSquare size={12} /> Perguntar
                </button>
              </div>
              <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-colors"></div>
            </div>

            {/* Monthly Summary Card */}
            <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <PieChart size={14} /> Resumo do Mês
                </h3>
                <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full uppercase">
                  {format(new Date(), 'MMMM', { locale: ptBR })}
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500 font-medium">Receitas do mês</span>
                  <span className="font-bold text-emerald-600">+{formatCurrency(monthlySummary.totalIncome)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500 font-medium">Despesas fixas</span>
                  <span className="font-bold text-rose-600">-{formatCurrency(monthlySummary.totalFixed)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500 font-medium">Variáveis estimadas</span>
                  <span className="font-bold text-zinc-900">-{formatCurrency(monthlySummary.monthlyVariable)}</span>
                </div>
                {monthlySummary.extraEvents > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-500 font-medium">Eventos extraordinários</span>
                    <span className="font-bold text-amber-600">-{formatCurrency(monthlySummary.extraEvents)}</span>
                  </div>
                )}
                <div className="pt-3 border-t border-zinc-100 flex justify-between items-center">
                  <span className="text-xs font-bold uppercase text-zinc-900">Saldo previsto no fim do mês</span>
                  <span className={cn(
                    "text-lg font-black",
                    monthlySummary.projectedRemaining < 0 ? "text-rose-600" : "text-zinc-900"
                  )}>
                    {formatCurrency(monthlySummary.projectedRemaining)}
                  </span>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm h-80">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Projeção 12 Semanas</h3>
                <button 
                  onClick={() => setIsSimPanelOpen(true)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all shadow-sm",
                    simulation.isActive 
                      ? "bg-amber-500 text-white border border-amber-600" 
                      : "bg-zinc-900 text-white hover:bg-zinc-800"
                  )}
                >
                  <TrendingUp size={14} />
                  {simulation.isActive ? 'Simulação Ativa' : 'Simular'}
                </button>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecast}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#18181b" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#18181b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSim" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                  <XAxis dataKey="start_date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#a1a1aa'}} />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
                    formatter={(val: number, name: string) => [
                      formatCurrency(val), 
                      name === 'projected_balance' ? 'Real' : 'Simulado'
                    ]}
                  />
                  <ReferenceLine y={settings.safety_threshold} stroke="#f43f5e" strokeDasharray="3 3" label={{ position: 'right', value: 'Limite', fill: '#f43f5e', fontSize: 8, fontWeight: 'bold' }} />
                  <Area 
                    type="monotone" 
                    dataKey="projected_balance" 
                    stroke="#18181b" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorBalance)" 
                    name="projected_balance"
                  />
                  {simulation.isActive && (
                    <Area 
                      type="monotone" 
                      dataKey="simulated_balance" 
                      stroke="#f59e0b" 
                      strokeWidth={3} 
                      strokeDasharray="6 6"
                      fillOpacity={1} 
                      fill="url(#colorSim)" 
                      name="simulated_balance"
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Forecast List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Linha do Tempo</h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-zinc-900 rounded-full"></div>
                    <span className="text-[8px] font-bold text-zinc-400 uppercase">Real</span>
                  </div>
                  {simulation.isActive && (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                      <span className="text-[8px] font-bold text-zinc-400 uppercase">Simulado</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                {forecast.map((week) => (
                  <div 
                    key={week.week_number}
                    className={cn(
                      "bg-white rounded-2xl p-5 border transition-all flex items-center justify-between group hover:border-zinc-300",
                      (simulation.isActive ? week.is_sim_below_threshold : week.is_below_threshold) 
                        ? "border-rose-200 bg-rose-50/30" 
                        : "border-zinc-200"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-bold text-[10px] transition-colors",
                        (simulation.isActive ? week.is_sim_below_threshold : week.is_below_threshold) 
                          ? "bg-rose-100 text-rose-600" 
                          : "bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200"
                      )}>
                        <span className="uppercase opacity-50 text-[8px]">Sem</span>
                        <span className="text-lg leading-none">{week.week_number}</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-900">{week.start_date} - {week.end_date}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {week.incomes.length > 0 && (
                            <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-100">
                              <ArrowUpRight size={10} />
                              <span className="text-[8px] font-bold uppercase">Receita</span>
                            </div>
                          )}
                          {week.events.length > 0 && (
                            <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg border border-amber-100">
                              <Calendar size={10} />
                              <span className="text-[8px] font-bold uppercase">Evento</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex flex-col items-end">
                        {simulation.isActive && (
                          <p className="text-[10px] text-zinc-400 line-through mb-0.5 font-medium">
                            {formatCurrency(week.projected_balance)}
                          </p>
                        )}
                        <p className={cn(
                          "text-base font-black tracking-tight",
                          (simulation.isActive ? week.is_sim_below_threshold : week.is_below_threshold) 
                            ? "text-rose-600" 
                            : "text-zinc-900"
                        )}>
                          {formatCurrency(simulation.isActive ? week.simulated_balance : week.projected_balance)}
                        </p>
                        <button 
                          onClick={() => setSelectedWeek(week)}
                          className="mt-1 text-[10px] font-bold text-zinc-400 uppercase hover:text-zinc-600 flex items-center gap-1 transition-colors"
                        >
                          <Info size={12} /> Ver explicação
                        </button>
                      </div>
                      {(simulation.isActive ? week.is_sim_below_threshold : week.is_below_threshold) && (
                        <p className="text-[10px] text-rose-500 font-bold flex items-center justify-end gap-1 mt-1.5">
                          <AlertTriangle size={12} /> Risco de Saldo
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'setup' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Global Settings */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <SettingsIcon size={16} className="text-zinc-400" />
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Configuração Geral</h3>
              </div>
              <div className="bg-white rounded-3xl p-6 border border-zinc-200 space-y-6 shadow-sm">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Saldo Bancário Atual</label>
                    <Wallet size={14} className="text-zinc-300" />
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400">{CURRENCY}</span>
                    <input 
                      type="number" 
                      value={settings.current_balance}
                      onChange={(e) => handleSaveSettings({...settings, current_balance: Number(e.target.value)})}
                      className="w-full bg-zinc-50 border-none rounded-2xl pl-14 pr-4 py-3 text-lg font-bold focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Gasto Semanal</label>
                    <input 
                      type="number" 
                      value={settings.weekly_spending_estimate}
                      onChange={(e) => handleSaveSettings({...settings, weekly_spending_estimate: Number(e.target.value)})}
                      className="w-full bg-zinc-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Limite Segurança</label>
                    <input 
                      type="number" 
                      value={settings.safety_threshold}
                      onChange={(e) => handleSaveSettings({...settings, safety_threshold: Number(e.target.value)})}
                      className="w-full bg-zinc-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                      <Users size={18} className="text-zinc-400" />
                    </div>
                    <div>
                      <span className="text-sm font-bold block">Modo Casal</span>
                      <span className="text-[10px] text-zinc-400 uppercase font-medium">Gestão Partilhada</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleSaveSettings({...settings, is_couple_mode: !settings.is_couple_mode})}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      settings.is_couple_mode ? "bg-zinc-900" : "bg-zinc-300"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all",
                      settings.is_couple_mode ? "right-1" : "left-1"
                    )}></div>
                  </button>
                </div>
              </div>
            </section>

            {/* Recurring Incomes */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <ArrowUpRight size={16} className="text-emerald-500" />
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Receitas Mensais</h3>
                </div>
                <button 
                  onClick={() => { setModalType('income'); setEditingItem(null); setIsModalOpen(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-[10px] font-bold uppercase shadow-sm hover:bg-emerald-700 transition-colors"
                >
                  <Plus size={14} /> Adicionar
                </button>
              </div>
              <div className="space-y-2">
                {incomes.map(inc => (
                  <div key={inc.id} className="bg-white rounded-2xl p-4 border border-zinc-200 flex items-center justify-between shadow-sm group hover:border-emerald-200 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                        <ArrowUpRight size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold">{inc.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-zinc-400 font-medium">Dia {inc.day_of_month}</span>
                          <span className="w-1 h-1 bg-zinc-200 rounded-full"></span>
                          <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-md font-bold uppercase">{inc.owner}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-emerald-600">{formatCurrency(inc.amount)}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit('income', inc)} className="text-zinc-400 hover:text-zinc-600 p-1.5 hover:bg-zinc-50 rounded-lg transition-colors">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => inc.id && handleDelete('income', inc.id)} className="text-zinc-400 hover:text-rose-500 p-1.5 hover:bg-rose-50 rounded-lg transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {incomes.length === 0 && (
                  <div className="bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-2xl p-8 text-center">
                    <p className="text-xs font-bold text-zinc-400 uppercase">Nenhuma receita registada</p>
                  </div>
                )}
              </div>
            </section>

            {/* Fixed Expenses */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <ArrowDownRight size={16} className="text-rose-500" />
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Despesas Fixas</h3>
                </div>
                <button 
                  onClick={() => { setModalType('expense'); setEditingItem(null); setIsModalOpen(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-xl text-[10px] font-bold uppercase shadow-sm hover:bg-rose-700 transition-colors"
                >
                  <Plus size={14} /> Adicionar
                </button>
              </div>
              <div className="space-y-2">
                {fixedExpenses.map(exp => (
                  <div key={exp.id} className="bg-white rounded-2xl p-4 border border-zinc-200 flex items-center justify-between shadow-sm group hover:border-rose-200 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                        <ArrowDownRight size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold">{exp.name}</p>
                        <p className="text-[10px] text-zinc-400 font-medium mt-0.5">Dia {exp.day_of_month}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-rose-600">-{formatCurrency(exp.amount)}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit('expense', exp)} className="text-zinc-400 hover:text-zinc-600 p-1.5 hover:bg-zinc-50 rounded-lg transition-colors">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => exp.id && handleDelete('expense', exp.id)} className="text-zinc-400 hover:text-rose-500 p-1.5 hover:bg-rose-50 rounded-lg transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {fixedExpenses.length === 0 && (
                  <div className="bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-2xl p-8 text-center">
                    <p className="text-xs font-bold text-zinc-400 uppercase">Nenhuma despesa fixa registada</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-amber-500" />
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Eventos Futuros</h3>
              </div>
              <button 
                onClick={() => { setModalType('event'); setEditingItem(null); setIsModalOpen(true); }}
                className="bg-zinc-900 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase flex items-center gap-2 shadow-sm hover:bg-zinc-800 transition-colors"
              >
                <Plus size={14} /> Novo Evento
              </button>
            </div>

            <div className="space-y-3">
              {events.map(evt => (
                <div key={evt.id} className="bg-white rounded-2xl p-4 border border-zinc-200 flex items-center justify-between shadow-sm group hover:border-amber-200 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                      <Calendar size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{evt.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-zinc-400 font-medium">{format(parseISO(evt.date), 'dd MMM yyyy', { locale: ptBR })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-rose-600">-{formatCurrency(evt.amount)}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit('event', evt)} className="text-zinc-400 hover:text-zinc-600 p-1.5 hover:bg-zinc-50 rounded-lg transition-colors">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => evt.id && handleDelete('event', evt.id)} className="text-zinc-400 hover:text-rose-500 p-1.5 hover:bg-rose-50 rounded-lg transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {events.length === 0 && (
                <div className="text-center py-16 bg-white rounded-3xl border border-zinc-100 shadow-sm">
                  <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-200">
                    <Calendar size={40} />
                  </div>
                  <p className="text-sm text-zinc-400 font-bold uppercase tracking-wider">Nenhum evento planejado</p>
                  <p className="text-[10px] text-zinc-400 mt-1">Adicione despesas pontuais como seguros ou férias</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'goals' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-500">
            <div className="flex items-center justify-between px-1">
              <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tight text-zinc-900">Metas Financeiras</h2>
                <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Planeie o seu futuro</p>
              </div>
              <button 
                onClick={() => { setModalType('goal'); setEditingItem(null); setIsModalOpen(true); }}
                className="w-12 h-12 bg-zinc-900 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-zinc-200 hover:bg-zinc-800 transition-all active:scale-95"
              >
                <Plus size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {goals.map((goal) => {
                const targetDate = parseISO(goal.target_date);
                const today = new Date();
                const totalWeeks = Math.max(1, Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 7)));
                const neededPerWeek = goal.target_amount / totalWeeks;
                
                return (
                  <div key={goal.id} className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-sm relative group overflow-hidden">
                    <div className="flex items-start justify-between relative z-10">
                      <div className="space-y-4 flex-1">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            goal.is_completed ? "bg-emerald-100 text-emerald-600" : "bg-indigo-100 text-indigo-600"
                          )}>
                            <Target size={20} />
                          </div>
                          <div>
                            <h3 className="text-lg font-black text-zinc-900 leading-tight">{goal.name}</h3>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                              Até {format(targetDate, 'MMMM yyyy', { locale: ptBR })}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Objetivo</p>
                            <p className="text-xl font-black text-zinc-900">{formatCurrency(goal.target_amount)}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Poup. Semanal</p>
                            <p className="text-xl font-black text-indigo-600">~{formatCurrency(neededPerWeek)}</p>
                          </div>
                        </div>

                        {!goal.is_completed && (
                          <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 flex items-center gap-3">
                            <Info size={16} className="text-indigo-500 shrink-0" />
                            <p className="text-[10px] font-bold text-indigo-700 leading-relaxed">
                              Para atingir esta meta em {totalWeeks} semanas, precisa de poupar cerca de {formatCurrency(neededPerWeek)} por semana.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEdit('goal', goal)}
                          className="p-2 text-zinc-400 hover:bg-zinc-50 rounded-xl transition-colors"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => goal.id && handleDelete('goal', goal.id)}
                          className="p-2 text-zinc-400 hover:bg-rose-50 hover:text-rose-500 rounded-xl transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    {goal.is_completed && (
                      <div className="absolute top-4 right-4 bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                        <CheckCircle2 size={12} /> Concluída
                      </div>
                    )}
                    
                    <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-zinc-50 rounded-full blur-2xl group-hover:bg-indigo-50 transition-colors"></div>
                  </div>
                );
              })}

              {goals.length === 0 && (
                <div className="text-center py-20 bg-white rounded-[40px] border border-zinc-100 shadow-sm">
                  <div className="w-24 h-24 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-6 text-zinc-200">
                    <Target size={48} />
                  </div>
                  <h3 className="text-lg font-black text-zinc-900 mb-2">Defina as suas Metas</h3>
                  <p className="text-xs text-zinc-400 font-medium max-w-[240px] mx-auto leading-relaxed">
                    Quer comprar um carro? Poupar para as férias? Defina um valor e uma data e o assistente ajudará a chegar lá.
                  </p>
                  <button 
                    onClick={() => { setModalType('goal'); setEditingItem(null); setIsModalOpen(true); }}
                    className="mt-8 bg-zinc-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-zinc-200 hover:bg-zinc-800 transition-all active:scale-95"
                  >
                    Criar Primeira Meta
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 px-6 py-3 pb-8 z-40">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button 
            onClick={() => setActiveTab('forecast')}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              activeTab === 'forecast' ? "text-zinc-900" : "text-zinc-400"
            )}
          >
            <LayoutDashboard size={24} />
            <span className="text-[10px] font-bold uppercase">Previsão</span>
          </button>
          <button 
            onClick={() => setActiveTab('events')}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              activeTab === 'events' ? "text-zinc-900" : "text-zinc-400"
            )}
          >
            <Calendar size={24} />
            <span className="text-[10px] font-bold uppercase">Eventos</span>
          </button>
          <button 
            onClick={() => setActiveTab('goals')}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              activeTab === 'goals' ? "text-zinc-900" : "text-zinc-400"
            )}
          >
            <Target size={24} />
            <span className="text-[10px] font-bold uppercase">Metas</span>
          </button>
          <button 
            onClick={() => setActiveTab('setup')}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              activeTab === 'setup' ? "text-zinc-900" : "text-zinc-400"
            )}
          >
            <SettingsIcon size={24} />
            <span className="text-[10px] font-bold uppercase">Ajustes</span>
          </button>
        </div>
      </nav>

      {/* Floating AI Button */}
      <button 
        onClick={() => setIsAIPanelOpen(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-indigo-600 text-white rounded-2xl shadow-2xl shadow-indigo-200 flex items-center justify-center hover:bg-indigo-700 transition-all active:scale-90 z-40 animate-bounce-slow"
      >
        <Sparkles size={24} />
      </button>

      {/* Simulation Panel */}
      {isSimPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-zinc-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden animate-in slide-in-from-bottom duration-300 max-h-[90vh] flex flex-col">
            <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between bg-amber-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-amber-900 tracking-tight">Modo Simulação</h2>
                  <p className="text-[10px] text-amber-600 uppercase font-bold tracking-widest">Teste cenários hipotéticos</p>
                </div>
              </div>
              <button onClick={() => setIsSimPanelOpen(false)} className="p-2 text-amber-400 hover:bg-amber-100 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Toggle Simulation */}
              <div className="flex items-center justify-between p-5 bg-amber-50 rounded-[24px] border border-amber-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                    simulation.isActive ? "bg-amber-500 text-white" : "bg-white text-zinc-300"
                  )}>
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-amber-900">Ativar Simulação</p>
                    <p className="text-[10px] text-amber-600 uppercase font-bold">Ver impacto no gráfico</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSimulation(s => ({ ...s, isActive: !s.isActive }))}
                  className={cn(
                    "w-14 h-7 rounded-full transition-all relative",
                    simulation.isActive ? "bg-amber-500" : "bg-zinc-200"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all",
                    simulation.isActive ? "right-1" : "left-1"
                  )}></div>
                </button>
              </div>

              {/* Weekly Spending Delta */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <PieChart size={14} className="text-zinc-400" />
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Alterar Gasto Semanal</label>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[0, 50, 100, 200, 500].map(delta => (
                    <button
                      key={delta}
                      onClick={() => setSimulation(s => ({ ...s, weeklySpendingDelta: delta, isActive: true }))}
                      className={cn(
                        "py-4 rounded-2xl text-xs font-black border transition-all shadow-sm",
                        simulation.weeklySpendingDelta === delta 
                          ? "bg-amber-100 border-amber-300 text-amber-700 ring-2 ring-amber-200" 
                          : "bg-zinc-50 border-zinc-100 text-zinc-500 hover:border-zinc-200 hover:bg-white"
                      )}
                    >
                      +{delta} {CURRENCY}
                    </button>
                  ))}
                  <button
                    onClick={() => setSimulation({ isActive: false, weeklySpendingDelta: 0, oneOffExpenses: [], incomeChanges: [] })}
                    className="py-4 rounded-2xl text-[10px] font-black bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center gap-1.5 uppercase tracking-wider hover:bg-rose-100 transition-colors"
                  >
                    <RotateCcw size={14} /> Limpar
                  </button>
                </div>
              </div>

              {/* Large Purchase / One-off Expense */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <ArrowDownRight size={14} className="text-zinc-400" />
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Simular Compra Grande</label>
                </div>
                <div className="space-y-3">
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const amount = Number(fd.get('amount'));
                      const description = fd.get('description') as string;
                      const date = fd.get('date') as string;
                      if (!amount || !description || !date) return;
                      setSimulation(s => ({
                        ...s,
                        isActive: true,
                        oneOffExpenses: [...s.oneOffExpenses, { amount, description, date }]
                      }));
                      e.currentTarget.reset();
                    }}
                    className="bg-zinc-50 p-5 rounded-[24px] border border-zinc-100 space-y-4 shadow-inner"
                  >
                    <input name="description" placeholder="Ex: Laptop, Reparação Carro" className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
                    <div className="grid grid-cols-2 gap-3">
                      <input name="amount" type="number" placeholder="Valor" className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
                      <input name="date" type="date" className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
                    </div>
                    <button type="submit" className="w-full bg-amber-500 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-200 hover:bg-amber-600 transition-all active:scale-[0.98]">
                      Adicionar à Simulação
                    </button>
                  </form>
                  
                  <div className="space-y-2">
                    {simulation.oneOffExpenses.map((exp, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-white border border-zinc-100 rounded-2xl shadow-sm animate-in slide-in-from-right duration-300">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                          <div>
                            <p className="text-sm font-black text-zinc-900">{exp.description}</p>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase">{format(parseISO(exp.date), 'dd MMM', { locale: ptBR })}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="text-sm font-black text-rose-600">-{formatCurrency(exp.amount)}</p>
                          <button 
                            onClick={() => setSimulation(s => ({
                              ...s,
                              oneOffExpenses: s.oneOffExpenses.filter((_, i) => i !== idx)
                            }))}
                            className="text-zinc-300 hover:text-rose-500 p-1 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Income Changes */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <ArrowUpRight size={14} className="text-zinc-400" />
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Simular Rendimento Extra</label>
                </div>
                <div className="space-y-3">
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const amount = Number(fd.get('amount'));
                      const description = fd.get('description') as string;
                      const date = fd.get('date') as string;
                      if (!amount || !description || !date) return;
                      setSimulation(s => ({
                        ...s,
                        isActive: true,
                        incomeChanges: [...s.incomeChanges, { amount, description, date }]
                      }));
                      e.currentTarget.reset();
                    }}
                    className="bg-zinc-50 p-5 rounded-[24px] border border-zinc-100 space-y-4 shadow-inner"
                  >
                    <input name="description" placeholder="Ex: Bónus, Aumento Salarial" className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-400 transition-all" />
                    <div className="grid grid-cols-2 gap-3">
                      <input name="amount" type="number" placeholder="Valor" className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-400 transition-all" />
                      <input name="date" type="date" className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-400 transition-all" />
                    </div>
                    <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-[0.98]">
                      Adicionar à Simulação
                    </button>
                  </form>
                  
                  <div className="space-y-2">
                    {simulation.incomeChanges.map((inc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-white border border-zinc-100 rounded-2xl shadow-sm animate-in slide-in-from-right duration-300">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                          <div>
                            <p className="text-sm font-black text-zinc-900">{inc.description}</p>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase">{format(parseISO(inc.date), 'dd MMM', { locale: ptBR })}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="text-sm font-black text-emerald-600">+{formatCurrency(inc.amount)}</p>
                          <button 
                            onClick={() => setSimulation(s => ({
                              ...s,
                              incomeChanges: s.incomeChanges.filter((_, i) => i !== idx)
                            }))}
                            className="text-zinc-300 hover:text-rose-500 p-1 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-zinc-100 bg-white">
              <button 
                onClick={() => setIsSimPanelOpen(false)}
                className="w-full bg-zinc-900 text-white py-4 rounded-[20px] font-black uppercase tracking-widest shadow-xl shadow-zinc-200 hover:bg-zinc-800 transition-all active:scale-[0.98]"
              >
                Ver Impacto no Forecast
              </button>
            </div>
          </div>
        </div>
      )}
      {/* AI Panel */}
      {isAIPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-zinc-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] overflow-hidden animate-in slide-in-from-bottom duration-500 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between bg-indigo-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                  <Brain size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight text-indigo-900">Assistente Financeiro AI</h2>
                  <p className="text-[10px] text-indigo-600 uppercase font-bold tracking-widest">Inteligência Artificial</p>
                </div>
              </div>
              <button onClick={() => setIsAIPanelOpen(false)} className="p-2 text-indigo-400 hover:bg-indigo-100 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Analysis Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-indigo-500" />
                    <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Análise de Saúde</h3>
                  </div>
                  <button 
                    onClick={handleRunAIAnalysis}
                    disabled={isAnalyzing}
                    className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                    Analisar Finanças
                  </button>
                </div>

                {!aiAnalysis && !isAnalyzing && (
                  <div className="bg-zinc-50 rounded-2xl p-8 text-center border-2 border-dashed border-zinc-100">
                    <Brain size={32} className="mx-auto text-zinc-200 mb-3" />
                    <p className="text-xs font-bold text-zinc-400 uppercase">Clique em analisar para começar</p>
                  </div>
                )}

                {isAnalyzing && (
                  <div className="bg-indigo-50 rounded-2xl p-8 text-center border border-indigo-100 animate-pulse">
                    <Loader2 size={32} className="mx-auto text-indigo-400 mb-3 animate-spin" />
                    <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">O Assistente está a analisar os seus dados...</p>
                  </div>
                )}

                {aiAnalysis && !isAnalyzing && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                    {/* Health Summary */}
                    <div className={cn(
                      "p-5 rounded-[24px] border shadow-sm flex items-center gap-4",
                      aiAnalysis.healthStatus === 'Boa' ? "bg-emerald-50 border-emerald-100" :
                      aiAnalysis.healthStatus === 'Moderada' ? "bg-amber-50 border-amber-100" :
                      "bg-rose-50 border-rose-100"
                    )}>
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                        aiAnalysis.healthStatus === 'Boa' ? "bg-emerald-100 text-emerald-600" :
                        aiAnalysis.healthStatus === 'Moderada' ? "bg-amber-100 text-amber-600" :
                        "bg-rose-100 text-rose-600"
                      )}>
                        {aiAnalysis.healthStatus === 'Boa' ? <CheckCircle2 size={24} /> :
                         aiAnalysis.healthStatus === 'Moderada' ? <AlertCircle size={24} /> :
                         <AlertTriangle size={24} />}
                      </div>
                      <div>
                        <p className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          aiAnalysis.healthStatus === 'Boa' ? "text-emerald-600" :
                          aiAnalysis.healthStatus === 'Moderada' ? "text-amber-600" :
                          "text-rose-600"
                        )}>Saúde Financeira: {aiAnalysis.healthStatus}</p>
                        <p className="text-sm font-bold text-zinc-900 leading-tight mt-0.5">{aiAnalysis.healthSummary}</p>
                      </div>
                    </div>

                    {/* Insights */}
                    <div className="space-y-2">
                      {aiAnalysis.insights.map((insight, idx) => (
                        <div key={idx} className="bg-white border border-zinc-100 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                          <div className={cn(
                            "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                            insight.type === 'risk' ? "bg-rose-100 text-rose-600" :
                            insight.type === 'suggestion' ? "bg-blue-100 text-blue-600" :
                            insight.type === 'impact' ? "bg-amber-100 text-amber-600" :
                            "bg-emerald-100 text-emerald-600"
                          )}>
                            {insight.type === 'risk' ? <AlertTriangle size={14} /> :
                             insight.type === 'suggestion' ? <Brain size={14} /> :
                             insight.type === 'impact' ? <TrendingDown size={14} /> :
                             <TrendingUp size={14} />}
                          </div>
                          <p className={cn(
                            "text-xs font-bold leading-relaxed",
                            insight.type === 'risk' ? "text-rose-700" : "text-zinc-700"
                          )}>{insight.message}</p>
                        </div>
                      ))}
                    </div>

                    {/* Suggestions */}
                    <div className="bg-zinc-900 rounded-[24px] p-6 text-white space-y-4">
                      <div className="flex items-center gap-2">
                        <Target size={16} className="text-indigo-400" />
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Sugestões Práticas</h4>
                      </div>
                      <ul className="space-y-3">
                        {aiAnalysis.suggestions.map((s, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></div>
                            <p className="text-xs font-medium text-zinc-300">{s}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Section */}
              <div className="space-y-4 pt-4 border-t border-zinc-100">
                <div className="flex items-center gap-2 px-1">
                  <MessageSquare size={14} className="text-indigo-500" />
                  <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Perguntar à AI</h3>
                </div>

                <div className="space-y-4">
                  {chatHistory.length === 0 && (
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        "Posso comprar um carro de 10.000 CHF?",
                        "Quanto posso gastar por semana?",
                        "Se aumentar a renda em 300 CHF o que acontece?"
                      ].map((q, idx) => (
                        <button 
                          key={idx}
                          onClick={() => { setChatInput(q); }}
                          className="text-left p-3 bg-zinc-50 hover:bg-zinc-100 rounded-xl text-xs font-bold text-zinc-600 transition-colors border border-zinc-100"
                        >
                          "{q}"
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {chatHistory.map((msg, idx) => (
                      <div key={idx} className={cn(
                        "flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
                        msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                      )}>
                        <div className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                          msg.role === 'user' ? "bg-zinc-900 text-white" : "bg-indigo-100 text-indigo-600"
                        )}>
                          {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                        </div>
                        <div className={cn(
                          "p-4 rounded-2xl text-xs font-medium max-w-[80%] shadow-sm",
                          msg.role === 'user' ? "bg-zinc-900 text-white rounded-tr-none" : "bg-white border border-zinc-100 text-zinc-800 rounded-tl-none"
                        )}>
                          {msg.role === 'model' ? (
                            <div className="markdown-body">
                              <ReactMarkdown>{msg.text}</ReactMarkdown>
                            </div>
                          ) : msg.text}
                        </div>
                      </div>
                    ))}
                    {isAsking && (
                      <div className="flex gap-3 animate-pulse">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                          <Bot size={16} />
                        </div>
                        <div className="p-4 rounded-2xl bg-white border border-zinc-100 rounded-tl-none">
                          <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleAskAI} className="relative">
                    <input 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Faça uma pergunta..."
                      className="w-full bg-zinc-50 border-none rounded-2xl pl-5 pr-14 py-4 font-bold outline-none focus:ring-2 focus:ring-indigo-600 transition-all shadow-inner"
                    />
                    <button 
                      type="submit"
                      disabled={!chatInput.trim() || isAsking}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-90"
                    >
                      <Send size={18} />
                    </button>
                  </form>
                </div>
              </div>
            </div>
            
            <div className="p-8 border-t border-zinc-100 bg-white">
              <button 
                onClick={() => setIsAIPanelOpen(false)}
                className="w-full bg-zinc-900 text-white py-4 rounded-[20px] font-black uppercase tracking-widest shadow-xl shadow-zinc-200 hover:bg-zinc-800 transition-all active:scale-[0.98]"
              >
                Fechar Assistente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-zinc-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] overflow-hidden animate-in slide-in-from-bottom duration-500 shadow-2xl">
            <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  modalType === 'income' ? "bg-emerald-100 text-emerald-600" : 
                  modalType === 'expense' ? "bg-rose-100 text-rose-600" : 
                  modalType === 'goal' ? "bg-indigo-100 text-indigo-600" : "bg-amber-100 text-amber-600"
                )}>
                  {modalType === 'income' ? <ArrowUpRight size={24} /> : 
                   modalType === 'expense' ? <ArrowDownRight size={24} /> : 
                   modalType === 'goal' ? <Target size={24} /> : <Calendar size={24} />}
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight">
                    {editingItem ? 'Editar' : 'Adicionar'} {modalType === 'income' ? 'Receita' : modalType === 'expense' ? 'Despesa Fixa' : modalType === 'goal' ? 'Meta' : 'Evento'}
                  </h2>
                  <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">Gestão Financeira</p>
                </div>
              </div>
              <button onClick={() => { setIsModalOpen(false); setEditingItem(null); }} className="p-2 text-zinc-400 hover:bg-zinc-100 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <form key={editingItem?.id || 'new'} onSubmit={handleAddItem} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Descrição</label>
                <input 
                  name={modalType === 'event' ? 'description' : 'name'} 
                  defaultValue={editingItem ? (modalType === 'event' ? editingItem.description : editingItem.name) : ''}
                  required 
                  placeholder={modalType === 'goal' ? "Ex: Comprar Carro, Férias..." : "Ex: Salário, Renda, Seguro..."}
                  className="w-full bg-zinc-50 border-none rounded-2xl px-5 py-4 font-bold outline-none focus:ring-2 focus:ring-zinc-900 transition-all shadow-inner" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">
                    {modalType === 'goal' ? 'Valor Alvo' : 'Valor'} ({CURRENCY})
                  </label>
                  <input 
                    name={modalType === 'goal' ? 'target_amount' : 'amount'} 
                    type="number" 
                    step="0.01" 
                    defaultValue={editingItem ? (modalType === 'goal' ? editingItem.target_amount : editingItem.amount) : ''}
                    required 
                    placeholder="0.00"
                    className="w-full bg-zinc-50 border-none rounded-2xl px-5 py-4 font-bold outline-none focus:ring-2 focus:ring-zinc-900 transition-all shadow-inner" 
                  />
                </div>
                
                {modalType === 'income' || modalType === 'expense' ? (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Dia do Mês</label>
                    <input 
                      name="day_of_month" 
                      type="number" 
                      min="1" 
                      max="31" 
                      defaultValue={editingItem?.day_of_month || ''}
                      required 
                      placeholder="1-31"
                      className="w-full bg-zinc-50 border-none rounded-2xl px-5 py-4 font-bold outline-none focus:ring-2 focus:ring-zinc-900 transition-all shadow-inner" 
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">
                      {modalType === 'goal' ? 'Data Alvo' : 'Data'}
                    </label>
                    <input 
                      name={modalType === 'goal' ? 'target_date' : 'date'} 
                      type="date" 
                      defaultValue={editingItem ? (modalType === 'goal' ? editingItem.target_date : editingItem.date) : ''}
                      required 
                      className="w-full bg-zinc-50 border-none rounded-2xl px-5 py-4 font-bold outline-none focus:ring-2 focus:ring-zinc-900 transition-all shadow-inner" 
                    />
                  </div>
                )}
              </div>

              {modalType === 'goal' && (
                <div className="flex items-center gap-3 bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                  <input 
                    type="checkbox" 
                    name="is_completed" 
                    defaultChecked={editingItem?.is_completed}
                    className="w-5 h-5 rounded-lg border-zinc-200 text-zinc-900 focus:ring-zinc-900"
                  />
                  <label className="text-xs font-bold text-zinc-600 uppercase tracking-widest">Meta Concluída</label>
                </div>
              )}

              {modalType === 'income' && settings.is_couple_mode && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Dono da Receita</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['rodrigo', 'ana', 'shared'].map(owner => (
                      <label key={owner} className="relative cursor-pointer">
                        <input 
                          type="radio" 
                          name="owner" 
                          value={owner} 
                          defaultChecked={(editingItem?.owner || 'shared') === owner}
                          className="peer sr-only"
                        />
                        <div className="flex items-center justify-center py-3 rounded-xl bg-zinc-50 border border-zinc-100 text-[10px] font-black uppercase text-zinc-400 peer-checked:bg-zinc-900 peer-checked:text-white peer-checked:border-zinc-900 transition-all">
                          {owner === 'rodrigo' ? 'Rodrigo' : owner === 'ana' ? 'Ana' : 'Ambos'}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4">
                <button type="submit" className={cn(
                  "w-full py-5 rounded-[20px] font-black uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98]",
                  modalType === 'income' ? "bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700" : 
                  modalType === 'expense' ? "bg-rose-600 text-white shadow-rose-100 hover:bg-rose-700" : 
                  "bg-amber-500 text-white shadow-amber-100 hover:bg-amber-600"
                )}>
                  <Save size={20} /> {editingItem ? 'Guardar Alterações' : 'Adicionar Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forecast Explanation Modal */}
      {selectedWeek && (
        <ForecastExplanation 
          week={selectedWeek} 
          onClose={() => setSelectedWeek(null)} 
          formatCurrency={formatCurrency}
          settings={settings}
        />
      )}

      {/* Settings Quick Edit Modal */}
      {isSettingsModalOpen && (
        <SettingsQuickEdit 
          type={settingsModalType}
          settings={settings}
          onClose={() => setIsSettingsModalOpen(false)}
          onSave={handleUpdateSettings}
        />
      )}
    </div>
  );
}

function ForecastExplanation({ week, onClose, formatCurrency, settings }: { 
  week: ForecastWeek; 
  onClose: () => void; 
  formatCurrency: (v: number) => string;
  settings: AppSettings;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
      <div 
        className="bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 duration-500"
      >
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h3 className="text-lg font-black text-zinc-900 tracking-tight">Explicação da Previsão</h3>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Semana {week.week_number} — {week.start_date} até {week.end_date}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:border-zinc-300 transition-all shadow-sm"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100">
              <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Saldo Inicial</p>
              <p className="text-lg font-black text-zinc-900">{formatCurrency(week.start_balance)}</p>
            </div>
            <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
              <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Saldo Final</p>
              <p className="text-lg font-black text-white">{formatCurrency(week.projected_balance)}</p>
            </div>
          </div>

          {/* Movements */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-1">Movimentações da Semana</h4>
            <div className="space-y-2">
              {week.movements.map((m, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50/50 border border-zinc-100">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      m.type === 'income' ? "bg-emerald-100 text-emerald-600" : 
                      m.type === 'expense' ? "bg-rose-100 text-rose-600" :
                      m.type === 'spending' ? "bg-amber-100 text-amber-600" : "bg-zinc-100 text-zinc-600"
                    )}>
                      {m.type === 'income' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-900">{m.name}</p>
                      <p className="text-[10px] font-medium text-zinc-400 uppercase">{m.type === 'income' ? 'Receita' : m.type === 'spending' ? 'Gasto Estimado' : 'Despesa'}</p>
                    </div>
                  </div>
                  <p className={cn(
                    "text-sm font-black",
                    m.type === 'income' ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {m.type === 'income' ? '+' : '-'}{formatCurrency(m.amount)}
                  </p>
                </div>
              ))}
              {week.movements.length === 0 && (
                <p className="text-center py-4 text-sm text-zinc-400 italic">Nenhuma movimentação específica nesta semana.</p>
              )}
            </div>
          </div>

          {/* Warning */}
          {week.is_below_threshold && (
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="text-rose-500 shrink-0" size={20} />
              <div>
                <p className="text-sm font-bold text-rose-900">Atenção ao Limite</p>
                <p className="text-xs text-rose-600 font-medium mt-0.5">
                  ⚠ Saldo abaixo do limite de segurança ({formatCurrency(settings.safety_threshold)}) nesta semana.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-zinc-50 border-t border-zinc-100">
          <button 
            onClick={onClose}
            className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold text-sm hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-200"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsQuickEdit({ type, settings, onClose, onSave }: {
  type: 'balance' | 'spending' | 'threshold';
  settings: AppSettings;
  onClose: () => void;
  onSave: (s: Partial<AppSettings>) => void;
}) {
  const [value, setValue] = useState(
    type === 'balance' ? settings.current_balance :
    type === 'spending' ? settings.weekly_spending_estimate :
    settings.safety_threshold
  );

  const title = type === 'balance' ? 'Saldo Atual' :
                type === 'spending' ? 'Gasto Semanal Estimado' :
                'Limite de Segurança';

  const field = type === 'balance' ? 'current_balance' :
                type === 'spending' ? 'weekly_spending_estimate' :
                'safety_threshold';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-sm rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 duration-500">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <h3 className="text-lg font-black text-zinc-900 tracking-tight">Alterar {title}</h3>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:border-zinc-300 transition-all shadow-sm"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Novo Valor (CHF)</label>
            <input 
              type="number" 
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              autoFocus
              className="w-full bg-zinc-50 border-none rounded-2xl px-5 py-4 text-2xl font-black outline-none focus:ring-2 focus:ring-zinc-900 transition-all shadow-inner" 
            />
          </div>
          <button 
            onClick={() => onSave({ [field]: value })}
            className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold text-sm hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-200 flex items-center justify-center gap-2"
          >
            <Save size={18} /> Guardar Alteração
          </button>
        </div>
      </div>
    </div>
  );
}