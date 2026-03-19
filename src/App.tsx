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
  User as UserIcon,
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
  Loader2,
  Globe,
  Coins,
  Heart
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
  isSameDay,
  startOfDay
} from 'date-fns';
import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  handleFirestoreError,
  OperationType,
  User
} from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Tutorial } from './components/Tutorial';
import { AICoach } from './components/AICoach';
import { RecoveryPlan } from './components/RecoveryPlan';
import { FinancialHealth } from './components/FinancialHealth';
import { ForecastGraph } from './components/ForecastGraph';
import { calculateForecast } from './services/forecastService';
import { cn } from './lib/utils';
import { enUS, ptBR } from 'date-fns/locale';
import { fetchExchangeRates } from './services/exchangeService';
import { TRANSLATIONS, Language } from './translations';
import { AppSettings, Income, FixedExpense, FutureEvent, ForecastWeek, SimulationState, AIAnalysis, ChatMessage, FinancialGoal, Movement } from './types';
import { generateFinancialAnalysis, askFinancialQuestion } from './services/aiService';
import ReactMarkdown from 'react-markdown';

type Tab = 'forecast' | 'setup' | 'events' | 'goals';

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

const SUPPORTED_CURRENCIES = [
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr.' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
];

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('forecast');
  const [settings, setSettings] = useState<AppSettings>({
    current_balance: 0,
    weekly_spending_estimate: 0,
    safety_threshold: 1000,
    is_couple_mode: true,
    user_name: 'Me',
    partner_name: 'Partner',
    currency: 'CHF',
    remittance_currency: 'EUR',
    exchange_rate: 1.05,
    language: 'en',
    onboarding_completed: false
  });
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [events, setEvents] = useState<FutureEvent[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [forecastWeeks, setForecastWeeks] = useState(12);
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
  const [isCurrencySelectorOpen, setIsCurrencySelectorOpen] = useState(false);
  const [aiAnalysis, setAIAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [runTutorial, setRunTutorial] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<ForecastWeek | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsModalType, setSettingsModalType] = useState<'balance' | 'spending' | 'threshold'>('balance');
  const [highlightedWeek, setHighlightedWeek] = useState<number | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingData, setOnboardingData] = useState<{
    incomes: any[];
    expenses: any[];
  }>({ incomes: [], expenses: [] });
  const [converterAmount, setConverterAmount] = useState<number>(0);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Auth state changed:", user ? "Logged in" : "Logged out");
      setUser(user);
      setIsAuthReady(true);
    });

    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log("Redirect login success:", result.user.email);
        }
      })
      .catch((error) => {
        console.error("Redirect login error:", error);
      });

    return () => unsubscribe();
  }, []);

  // Firestore Sync
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const userId = user.uid;

    const settingsUnsubscribe = onSnapshot(doc(db, 'users', userId, 'settings', 'current'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as AppSettings;
        setSettings(data);
      } else {
        // Initialize settings if they don't exist
        const initialSettings: AppSettings = {
          current_balance: 0,
          weekly_spending_estimate: 0,
          safety_threshold: 1000,
          is_couple_mode: true,
          user_name: 'Me',
          partner_name: 'Partner',
          currency: 'CHF',
          remittance_currency: 'EUR',
          exchange_rate: 1.05,
          language: 'en',
          onboarding_completed: false
        };
        setDoc(doc(db, 'users', userId, 'settings', 'current'), initialSettings)
          .catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${userId}/settings/current`));
      }
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${userId}/settings/current`));

    // Incomes
    const incomesUnsubscribe = onSnapshot(collection(db, 'users', userId, 'incomes'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setIncomes(data);
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${userId}/incomes`));

    // Fixed Expenses
    const expensesUnsubscribe = onSnapshot(collection(db, 'users', userId, 'fixedExpenses'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setFixedExpenses(data);
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${userId}/fixedExpenses`));

    // Events
    const eventsUnsubscribe = onSnapshot(collection(db, 'users', userId, 'events'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setEvents(data);
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${userId}/events`));

    // Goals
    const goalsUnsubscribe = onSnapshot(collection(db, 'users', userId, 'goals'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setGoals(data);
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${userId}/goals`));

    return () => {
      settingsUnsubscribe();
      incomesUnsubscribe();
      expensesUnsubscribe();
      eventsUnsubscribe();
      goalsUnsubscribe();
    };
  }, [isAuthReady, user]);

  useEffect(() => {
    const updateRates = async () => {
      const today = new Date().toISOString().split('T')[0];
      if (settings.last_exchange_update !== today) {
        const rates = await fetchExchangeRates(settings.currency);
        if (rates) {
          setExchangeRates(rates);
          const newRate = rates[settings.remittance_currency] || settings.exchange_rate;
          handleSaveSettings({
            ...settings,
            exchange_rate: newRate,
            last_exchange_update: today
          });
        }
      }
    };
    if (settings.onboarding_completed) {
      updateRates();
    }
  }, [settings.currency, settings.onboarding_completed]);

  const handleApplyAIAction = (action: any) => {
    if (action.type === 'update_spending') {
      setSettings(prev => ({ ...prev, weekly_spending_estimate: action.value }));
    } else if (action.type === 'update_threshold') {
      setSettings(prev => ({ ...prev, safety_threshold: action.value }));
    }
  };

  const handleRunAIAnalysis = async () => {
    console.log("Running AI Analysis...");
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

  const handleAskAI = async (e?: React.FormEvent, question?: string) => {
    if (e) e.preventDefault();
    const finalQuestion = question || chatInput;
    if (!finalQuestion.trim() || isAsking) return;

    console.log("Asking AI:", finalQuestion);
    const userMessage: ChatMessage = { role: 'user', text: finalQuestion };
    setChatHistory(prev => [...prev, userMessage]);
    if (!question) setChatInput('');
    setIsAsking(true);

    try {
      const response = await askFinancialQuestion(finalQuestion, {
        settings,
        incomes,
        fixedExpenses,
        events,
        forecast,
        simulation
      }, chatHistory);
      
      console.log("AI Response received");
      const modelMessage: ChatMessage = { role: 'model', text: response };
      setChatHistory(prev => [...prev, modelMessage]);
    } catch (error) {
      console.error('AI Chat error:', error);
    } finally {
      setIsAsking(false);
    }
  };

  const handleSaveSettings = async (newSettings: AppSettings) => {
    if (!user) return;
    try {
      const settingsToSave = {
        ...newSettings,
        balance_last_updated: newSettings.current_balance !== settings.current_balance 
          ? new Date().toISOString() 
          : newSettings.balance_last_updated || settings.balance_last_updated
      };
      await setDoc(doc(db, 'users', user.uid, 'settings', 'current'), settingsToSave);
      setSettings(settingsToSave);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/settings/current`);
    }
  };

  const handleCurrencyChange = async (newCurrency: string) => {
    const rates = await fetchExchangeRates(newCurrency);
    let newRemittance = settings.remittance_currency;
    
    if (newCurrency === 'EUR' && newRemittance === 'EUR') newRemittance = 'CHF';
    else if (newCurrency === 'CHF' && newRemittance === 'CHF') newRemittance = 'EUR';
    else if (newRemittance === newCurrency) {
      newRemittance = newCurrency === 'USD' ? 'EUR' : 'USD';
    }

    if (rates) {
      setExchangeRates(rates);
      const newRate = rates[newRemittance] || 1;
      handleSaveSettings({
        ...settings,
        currency: newCurrency,
        remittance_currency: newRemittance,
        exchange_rate: newRate,
        last_exchange_update: new Date().toISOString().split('T')[0]
      });
    } else {
      handleSaveSettings({
        ...settings,
        currency: newCurrency,
        remittance_currency: newRemittance
      });
    }
  };

  const effectiveBalance = useMemo(() => {
    if (!settings.balance_last_updated) return settings.current_balance;
    
    const startDate = parseISO(settings.balance_last_updated);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (isSameDay(startDate, today) || startDate > today) return settings.current_balance;

    let balance = settings.current_balance;
    
    // We calculate transactions from the day AFTER balance_last_updated up to YESTERDAY
    // Today's transactions will be handled by the forecast loop
    const startOfCalc = new Date(startDate);
    startOfCalc.setDate(startOfCalc.getDate() + 1);
    
    if (startOfCalc > yesterday) return balance;

    const days = eachDayOfInterval({ start: startOfCalc, end: yesterday });
    
    days.forEach(day => {
      const dayNum = getDate(day);
      
      incomes.forEach(inc => {
        if (inc.day_of_month === dayNum) balance += inc.amount;
      });
      
      fixedExpenses.forEach(exp => {
        if (exp.day_of_month === dayNum) balance -= exp.amount;
      });
      
      events.forEach(evt => {
        const evtDate = parseISO(evt.date);
        if (isSameDay(evtDate, day)) balance -= evt.amount;
      });
    });
    
    return balance;
  }, [settings.current_balance, settings.balance_last_updated, incomes, fixedExpenses, events]);

  const forecast = useMemo(() => {
    return calculateForecast(
      settings,
      incomes,
      fixedExpenses,
      events,
      simulation,
      forecastWeeks,
      effectiveBalance
    );
  }, [settings, incomes, fixedExpenses, events, simulation, forecastWeeks, effectiveBalance]);

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
        message: `Warning: balance below limit in week ${firstWeekBelow.week_number}`,
        icon: AlertTriangle
      });
    } else {
      alerts.push({
        type: 'success',
        message: `Good news: stable balance for the next ${forecastWeeks} weeks`,
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
        message: `Large expense (${formatCurrency(largeExpense.amount)}) approaching in ${diff} days`,
        icon: Bell
      });
    }

    // 3. Simulation risk
    if (simulation.isActive) {
      const simBelow = forecast.some(w => w.is_sim_below_threshold && !w.is_below_threshold);
      if (simBelow) {
        alerts.push({
          type: 'warning',
          message: "Simulation increases financial risk",
          icon: TrendingDown
        });
      }
    }

    return alerts;
  }, [forecast, events, simulation, settings]);

  const financialHealth = useMemo(() => {
    const firstWeekBelow = forecast.find(w => w.is_below_threshold);
    if (!firstWeekBelow) return { status: 'Excellent', color: 'text-emerald-500', explanation: 'Your balance stays above the safety limit for the entire forecast period.' };
    
    if (firstWeekBelow.week_number > 8) return { status: 'Good', color: 'text-blue-500', explanation: `Your balance falls below the safety limit in week ${firstWeekBelow.week_number}.` };
    if (firstWeekBelow.week_number > 4) return { status: 'Moderate', color: 'text-amber-500', explanation: `Your balance falls below the safety limit in week ${firstWeekBelow.week_number}.` };
    return { status: 'Risk', color: 'text-rose-500', explanation: `Your balance falls below the safety limit in week ${firstWeekBelow.week_number}.` };
  }, [forecast]);

  const t = TRANSLATIONS[settings.language as Language] || TRANSLATIONS.en;

  const formatCurrency = (value: number, currencyCode?: string) => {
    return new Intl.NumberFormat(settings.language === 'pt' ? 'pt-BR' : 'en-US', {
      style: 'currency',
      currency: currencyCode || settings.currency,
    }).format(value);
  };

  const getDateLocale = () => {
    return settings.language === 'pt' ? ptBR : enUS;
  };

  const formatRemittance = (value: number) => {
    const converted = value * settings.exchange_rate;
    return formatCurrency(converted, settings.remittance_currency);
  };

  const handleAddItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const data: any = Object.fromEntries(formData.entries());
    if (data.amount) data.amount = Number(data.amount);
    if (data.day_of_month) data.day_of_month = Number(data.day_of_month);
    if (data.target_amount) data.target_amount = Number(data.target_amount);
    if (data.is_completed !== undefined) data.is_completed = data.is_completed === 'on';

    let collectionName = '';
    if (modalType === 'income') collectionName = 'incomes';
    else if (modalType === 'expense') collectionName = 'fixedExpenses';
    else if (modalType === 'goal') collectionName = 'goals';
    else collectionName = 'events';

    try {
      const colRef = collection(db, 'users', user.uid, collectionName);
      if (editingItem) {
        await setDoc(doc(colRef, editingItem.id), data, { merge: true });
      } else {
        await setDoc(doc(colRef), data);
      }
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/${collectionName}`);
    }
  };

  const handleEdit = (type: 'income' | 'expense' | 'event' | 'goal', item: any) => {
    setModalType(type);
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (type: 'income' | 'expense' | 'event' | 'goal', id: string) => {
    if (!user) return;
    let collectionName = '';
    if (type === 'income') collectionName = 'incomes';
    else if (type === 'expense') collectionName = 'fixedExpenses';
    else if (type === 'goal') collectionName = 'goals';
    else collectionName = 'events';

    try {
      await deleteDoc(doc(db, 'users', user.uid, collectionName, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/${collectionName}/${id}`);
    }
  };

  const handleUpdateSettings = async (newSettings: Partial<AppSettings>) => {
    if (!user) return;
    try {
      const updated = { 
        ...settings, 
        ...newSettings,
        balance_last_updated: newSettings.current_balance !== undefined 
          ? new Date().toISOString() 
          : settings.balance_last_updated
      };
      await setDoc(doc(db, 'users', user.uid, 'settings', 'current'), updated, { merge: true });
      setSettings(updated);
      setIsSettingsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/settings/current`);
    }
  };

  const handleResetData = async () => {
    if (!user) return;
    if (window.confirm('Are you sure you want to reset all financial data? This cannot be undone.')) {
      try {
        setLoading(true);
        const userId = user.uid;

        // 1. Reset Settings to trigger onboarding
        const initialSettings: AppSettings = {
          current_balance: 0,
          weekly_spending_estimate: 0,
          safety_threshold: 1000,
          is_couple_mode: true,
          user_name: 'Me',
          partner_name: 'Partner',
          currency: 'CHF',
          remittance_currency: 'EUR',
          exchange_rate: 1.05,
          language: 'en',
          onboarding_completed: false
        };
        await setDoc(doc(db, 'users', userId, 'settings', 'current'), initialSettings);

        // 2. Clear all sub-collections
        const collectionsToClear = ['incomes', 'fixedExpenses', 'events', 'goals'];
        for (const colName of collectionsToClear) {
          const colRef = collection(db, 'users', userId, colName);
          const snapshot = await getDocs(colRef);
          const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'users', userId, colName, d.id)));
          await Promise.all(deletePromises);
        }

        localStorage.removeItem('futureflow_data');
        window.location.reload();
      } catch (error) {
        console.error("Reset error:", error);
        alert("Failed to reset data. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  };

  if (!settings.onboarding_completed && !loading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-6 text-white font-sans overflow-y-auto">
        <div className="max-w-md w-full space-y-8 py-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-zinc-900 mx-auto mb-6 shadow-2xl">
              <Wallet size={32} />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Welcome to Provera</h1>
            <p className="text-zinc-400 text-sm">Let's set up your financial planner.</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-8">
            {/* Step 0: Mode Selection */}
            {onboardingStep === 0 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-4">
                  <div className="w-20 h-20 bg-white/10 rounded-[32px] flex items-center justify-center mx-auto mb-6">
                    <Users size={40} className="text-white" />
                  </div>
                  <h2 className="text-3xl font-black text-center tracking-tight leading-tight">
                    How will you use <span className="text-emerald-400">Provera</span>?
                  </h2>
                  <p className="text-zinc-400 text-center text-sm max-w-[280px] mx-auto leading-relaxed">
                    Choose your planning mode. This will help us tailor the experience for you or your family.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <button 
                    onClick={() => {
                      setSettings(s => ({ ...s, is_couple_mode: false }));
                      setOnboardingStep(0.5);
                    }}
                    className="group bg-white/10 hover:bg-white/20 p-6 rounded-[32px] border border-white/5 transition-all text-left flex items-center gap-6"
                  >
                    <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <UserIcon size={28} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-black text-lg">Solo Mode</h3>
                      <p className="text-xs text-zinc-400 font-medium">Manage your personal finances individually.</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => {
                      setSettings(s => ({ ...s, is_couple_mode: true }));
                      setOnboardingStep(0.5);
                    }}
                    className="group bg-white/10 hover:bg-white/20 p-6 rounded-[32px] border border-white/5 transition-all text-left flex items-center gap-6"
                  >
                    <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Heart size={28} className="text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-black text-lg">Couple Mode</h3>
                      <p className="text-xs text-zinc-400 font-medium">Shared management with your partner. Track individual and joint incomes/expenses.</p>
                    </div>
                  </button>
                </div>
                
                <p className="text-[10px] text-zinc-500 text-center font-bold uppercase tracking-widest">
                  Don't worry, you can change this later in settings.
                </p>
              </div>
            )}

            {/* Step 0.5: Name Customization */}
            {onboardingStep === 0.5 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-4">
                  <div className="w-20 h-20 bg-white/10 rounded-[32px] flex items-center justify-center mx-auto mb-6">
                    <UserIcon size={40} className="text-white" />
                  </div>
                  <h2 className="text-3xl font-black text-center tracking-tight leading-tight">
                    Who are <span className="text-emerald-400">we</span>?
                  </h2>
                  <p className="text-zinc-400 text-center text-sm max-w-[280px] mx-auto leading-relaxed">
                    Personalize the names for your financial tracking.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Your Name</label>
                    <input 
                      type="text" 
                      value={settings.user_name}
                      onChange={(e) => setSettings(s => ({ ...s, user_name: e.target.value }))}
                      className="w-full bg-white/10 border-none rounded-2xl px-4 py-4 text-lg font-bold focus:ring-2 focus:ring-white outline-none transition-all"
                      placeholder="e.g. Me"
                    />
                  </div>

                  {settings.is_couple_mode && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Partner's Name</label>
                      <input 
                        type="text" 
                        value={settings.partner_name}
                        onChange={(e) => setSettings(s => ({ ...s, partner_name: e.target.value }))}
                        className="w-full bg-white/10 border-none rounded-2xl px-4 py-4 text-lg font-bold focus:ring-2 focus:ring-white outline-none transition-all"
                        placeholder="e.g. Partner"
                      />
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => setOnboardingStep(1)}
                  className="w-full bg-white text-zinc-900 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-zinc-200 transition-all"
                >
                  Continue
                </button>
              </div>
            )}

            {/* Step 1: Balance */}
            {onboardingStep === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Step 2: Current Balance</label>
                    <div className="relative">
                      <button 
                        onClick={() => setIsCurrencySelectorOpen(!isCurrencySelectorOpen)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-xl text-[10px] font-bold hover:bg-white/20 transition-all border border-white/5"
                      >
                        <Globe size={12} />
                        {settings.currency}
                      </button>
                      {isCurrencySelectorOpen && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-800 border border-white/10 rounded-2xl shadow-2xl z-50 p-2 grid grid-cols-2 gap-1 animate-in zoom-in-95 duration-200">
                          {SUPPORTED_CURRENCIES.map(curr => (
                            <button
                              key={curr.code}
                              onClick={() => {
                                handleCurrencyChange(curr.code);
                                setIsCurrencySelectorOpen(false);
                              }}
                              className={cn(
                                "px-2 py-2 rounded-xl text-[10px] font-bold transition-all text-left flex items-center justify-between",
                                settings.currency === curr.code ? "bg-white text-zinc-900" : "hover:bg-white/10 text-zinc-400"
                              )}
                            >
                              <span>{curr.code}</span>
                              <span className="opacity-50">{curr.symbol}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-zinc-300">How much money do you have in your bank account right now?</p>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-zinc-500">{settings.currency}</span>
                  <input 
                    type="number" 
                    autoFocus
                    placeholder="0.00"
                    className="w-full bg-white/10 border-none rounded-2xl pl-14 pr-4 py-4 text-2xl font-bold focus:ring-2 focus:ring-white outline-none transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && setOnboardingStep(2)}
                    onChange={(e) => setSettings(s => ({ ...s, current_balance: Number(e.target.value) }))}
                  />
                </div>
                <button 
                  onClick={() => setOnboardingStep(2)}
                  className="w-full bg-white text-zinc-900 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-zinc-200 transition-all"
                >
                  Continue
                </button>
              </div>
            )}

            {/* Step 2: Incomes */}
            {onboardingStep === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Step 3: Monthly Incomes</label>
                  <p className="text-sm text-zinc-300">Add monthly incomes {settings.is_couple_mode ? 'for both of you' : ''}.</p>
                </div>
                
                <div className="space-y-3">
                  {onboardingData.incomes.map((inc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                      <div>
                        <p className="font-bold text-sm">{inc.name}</p>
                        <p className="text-[10px] text-zinc-500 uppercase font-black">
                          {inc.owner === 'me' ? settings.user_name : inc.owner === 'partner' ? settings.partner_name : 'Both'} • Day {inc.day_of_month}
                        </p>
                      </div>
                      <p className="font-black text-emerald-400">+{formatCurrency(inc.amount)}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white/5 p-6 rounded-[32px] border border-white/10 space-y-4">
                  <input 
                    type="text" 
                    placeholder="Income Name (e.g. Salary)"
                    className="w-full bg-white/10 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-white outline-none transition-all"
                    id="onboarding-income-name"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <input 
                      type="number" 
                      placeholder="Amount"
                      className="w-full bg-white/10 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-white outline-none transition-all"
                      id="onboarding-income-amount"
                    />
                    <input 
                      type="number" 
                      placeholder="Day (1-31)"
                      className="w-full bg-white/10 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-white outline-none transition-all"
                      id="onboarding-income-day"
                    />
                  </div>
                  {settings.is_couple_mode && (
                    <div className="grid grid-cols-3 gap-2">
                      {['me', 'partner', 'shared'].map(owner => (
                        <button
                          key={owner}
                          id={`owner-${owner}`}
                          onClick={(e) => {
                            const btns = e.currentTarget.parentElement?.querySelectorAll('button');
                            btns?.forEach(b => b.classList.remove('bg-white', 'text-zinc-900'));
                            btns?.forEach(b => b.classList.add('bg-white/10', 'text-white'));
                            e.currentTarget.classList.remove('bg-white/10', 'text-white');
                            e.currentTarget.classList.add('bg-white', 'text-zinc-900');
                            (e.currentTarget as any).dataset.selected = 'true';
                          }}
                          className={cn(
                            "py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            owner === 'shared' ? "bg-white text-zinc-900" : "bg-white/10 text-white"
                          )}
                        >
                          {owner === 'me' ? settings.user_name : owner === 'partner' ? settings.partner_name : 'Both'}
                        </button>
                      ))}
                    </div>
                  )}
                  <button 
                    onClick={() => {
                      const name = (document.getElementById('onboarding-income-name') as HTMLInputElement).value;
                      const amount = Number((document.getElementById('onboarding-income-amount') as HTMLInputElement).value);
                      const day = Number((document.getElementById('onboarding-income-day') as HTMLInputElement).value);
                      let owner = 'shared';
                      if (settings.is_couple_mode) {
                        const selected = document.querySelector('[data-selected="true"]');
                        if (selected) owner = selected.id.replace('owner-', '');
                      }
                      
                      if (name && amount) {
                        setOnboardingData(prev => ({
                          ...prev,
                          incomes: [...prev.incomes, { name, amount, day_of_month: day, owner }]
                        }));
                        (document.getElementById('onboarding-income-name') as HTMLInputElement).value = '';
                        (document.getElementById('onboarding-income-amount') as HTMLInputElement).value = '';
                        (document.getElementById('onboarding-income-day') as HTMLInputElement).value = '';
                      }
                    }}
                    className="w-full bg-white/10 text-white py-3 rounded-2xl font-bold text-xs uppercase hover:bg-white/20 transition-all border border-dashed border-white/20"
                  >
                    + Add Income
                  </button>
                </div>

                <button 
                  onClick={() => setOnboardingStep(3)}
                  disabled={onboardingData.incomes.length === 0}
                  className="w-full bg-white text-zinc-900 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-zinc-200 transition-all disabled:opacity-50"
                >
                  Next Step
                </button>
              </div>
            )}

            {/* Step 3: Expenses */}
            {onboardingStep === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Step 4: Fixed Expenses</label>
                  <p className="text-sm text-zinc-300">Add your recurring bills (Rent, Netflix, etc).</p>
                </div>

                <div className="space-y-3">
                  {onboardingData.expenses.map((exp, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                      <div>
                        <p className="font-bold text-sm">{exp.name}</p>
                        <p className="text-[10px] text-zinc-500 uppercase font-black">
                          {exp.owner === 'me' ? settings.user_name : exp.owner === 'partner' ? settings.partner_name : 'Both'} • Day {exp.day_of_month}
                        </p>
                      </div>
                      <p className="font-black text-rose-400">-{formatCurrency(exp.amount)}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white/5 p-6 rounded-[32px] border border-white/10 space-y-4">
                  <input 
                    type="text" 
                    placeholder="Expense Name (e.g. Rent)"
                    className="w-full bg-white/10 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-white outline-none transition-all"
                    id="onboarding-expense-name"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <input 
                      type="number" 
                      placeholder="Amount"
                      className="w-full bg-white/10 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-white outline-none transition-all"
                      id="onboarding-expense-amount"
                    />
                    <input 
                      type="number" 
                      placeholder="Day (1-31)"
                      className="w-full bg-white/10 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-white outline-none transition-all"
                      id="onboarding-expense-day"
                    />
                  </div>
                  {settings.is_couple_mode && (
                    <div className="grid grid-cols-3 gap-2">
                      {['me', 'partner', 'shared'].map(owner => (
                        <button
                          key={owner}
                          id={`exp-owner-${owner}`}
                          onClick={(e) => {
                            const btns = e.currentTarget.parentElement?.querySelectorAll('button');
                            btns?.forEach(b => b.classList.remove('bg-white', 'text-zinc-900'));
                            btns?.forEach(b => b.classList.add('bg-white/10', 'text-white'));
                            e.currentTarget.classList.remove('bg-white/10', 'text-white');
                            e.currentTarget.classList.add('bg-white', 'text-zinc-900');
                          }}
                          className={cn(
                            "py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            owner === 'shared' ? "bg-white text-zinc-900" : "bg-white/10 text-white"
                          )}
                        >
                          {owner === 'me' ? settings.user_name : owner === 'partner' ? settings.partner_name : 'Both'}
                        </button>
                      ))}
                    </div>
                  )}
                  <button 
                    onClick={() => {
                      const name = (document.getElementById('onboarding-expense-name') as HTMLInputElement).value;
                      const amount = Number((document.getElementById('onboarding-expense-amount') as HTMLInputElement).value);
                      const day = Number((document.getElementById('onboarding-expense-day') as HTMLInputElement).value);
                      let owner = 'shared';
                      if (settings.is_couple_mode) {
                        const activeBtn = document.querySelector('[id^="exp-owner-"].bg-white');
                        if (activeBtn) owner = activeBtn.id.replace('exp-owner-', '');
                      }
                      
                      if (name && amount) {
                        setOnboardingData(prev => ({
                          ...prev,
                          expenses: [...prev.expenses, { name, amount, day_of_month: day, owner }]
                        }));
                        (document.getElementById('onboarding-expense-name') as HTMLInputElement).value = '';
                        (document.getElementById('onboarding-expense-amount') as HTMLInputElement).value = '';
                        (document.getElementById('onboarding-expense-day') as HTMLInputElement).value = '';
                      }
                    }}
                    className="w-full bg-white/10 text-white py-3 rounded-2xl font-bold text-xs uppercase hover:bg-white/20 transition-all border border-dashed border-white/20"
                  >
                    + Add Expense
                  </button>
                </div>

                <button 
                  onClick={() => setOnboardingStep(4)}
                  className="w-full bg-white text-zinc-900 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-zinc-200 transition-all"
                >
                  Next Step
                </button>
              </div>
            )}

            {/* Step 4: Weekly Spending */}
            {onboardingStep === 4 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Step 5: Weekly Spending</label>
                  <p className="text-sm text-zinc-300">Estimate your variable weekly spending (food, leisure, etc).</p>
                </div>
                <div className="space-y-4">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-zinc-500">{settings.currency}</span>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      className="w-full bg-white/10 border-none rounded-2xl pl-14 pr-4 py-4 text-2xl font-bold focus:ring-2 focus:ring-white outline-none transition-all"
                      onChange={(e) => setSettings(s => ({ ...s, weekly_spending_estimate: Number(e.target.value) }))}
                    />
                  </div>
                  <button 
                    onClick={async () => {
                      // Save all data
                      try {
                        const incRef = collection(db, 'users', user.uid, 'incomes');
                        const expRef = collection(db, 'users', user.uid, 'fixedExpenses');
                        
                        await Promise.all([
                          ...onboardingData.incomes.map(inc => setDoc(doc(incRef), inc)),
                          ...onboardingData.expenses.map(exp => setDoc(doc(expRef), exp)),
                          handleSaveSettings({ 
                            ...settings, 
                            onboarding_completed: true,
                            balance_last_updated: new Date().toISOString()
                          })
                        ]);
                        setRunTutorial(true);
                      } catch (err) {
                        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/setup`);
                      }
                    }}
                    className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    Complete Setup
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-center gap-2">
            {[0, 1, 2, 3, 4].map(step => (
              <div 
                key={step}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  onboardingStep === step ? "bg-white w-6" : "bg-white/20"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[32px] p-8 shadow-xl border border-zinc-100 text-center space-y-8">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto text-white shadow-lg shadow-indigo-200">
            <Wallet size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Provera</h1>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Master your cash flow with AI-powered forecasting. 
              Sign in to sync your data across devices.
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={async () => {
                try {
                  console.log("Starting popup login...");
                  
                await signInWithRedirect(auth, googleProvider);
                } catch (error: any) {
                  console.error("Popup login error:", error);
                  if (error.code === 'auth/popup-blocked') {
                    alert("Popup blocked! Please allow popups for this site or try the 'Redirect' option below.");
                  } else if (error.code === 'auth/unauthorized-domain') {
                    alert(`Domain not authorized. Please add ${window.location.hostname} to Firebase Authorized Domains.`);
                  } else {
                    alert(`Login failed: ${error.message}`);
                  }
                }
              }}
              className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-zinc-800 transition-all shadow-lg"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              Continue with Google
            </button>

            <button
              onClick={async () => {
                try {
                } catch (error: any) {
                  alert(`Redirect failed: ${error.message}`);
                }
              }}
              className="w-full bg-white text-zinc-600 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-zinc-50 transition-all border border-zinc-200"
            >
            </button>
          </div>
          <div className="pt-4">
            <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">
              Securely powered by Google Cloud
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto" />
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Loading your finances...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 pb-24">
      <Tutorial 
        run={runTutorial} 
        onFinish={() => setRunTutorial(false)} 
      />

      <AICoach 
        isOpen={isAIPanelOpen}
        onClose={() => setIsAIPanelOpen(false)}
        analysis={aiAnalysis}
        isAnalyzing={isAnalyzing}
        onRunAnalysis={handleRunAIAnalysis}
        chatHistory={chatHistory}
        isAsking={isAsking}
        onAsk={(q) => handleAskAI(undefined, q)}
        onApplyAction={handleApplyAIAction}
        t={t}
      />

      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white">
              <Wallet size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none">Provera</h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">{t.forecast}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative group">
              <button className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors">
                <Globe size={20} />
              </button>
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-zinc-100 p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 max-h-64 overflow-y-auto">
                {[
                  { code: 'en', name: 'English' },
                  { code: 'pt', name: 'Português' },
                  { code: 'es', name: 'Español' },
                  { code: 'fr', name: 'Français' },
                  { code: 'de', name: 'Deutsch' },
                  { code: 'it', name: 'Italiano' },
                  { code: 'zh', name: '中文' },
                  { code: 'ja', name: '日本語' },
                  { code: 'hi', name: 'हिन्दी' }
                ].map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => handleSaveSettings({ ...settings, language: lang.code as Language })}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl transition-colors",
                      settings.language === lang.code ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:bg-zinc-50"
                    )}
                  >
                    {lang.name}
                    {settings.language === lang.code && <CheckCircle2 size={14} className="text-emerald-500" />}
                  </button>
                ))}
              </div>
            </div>
            <button 
              onClick={() => setRunTutorial(true)}
              className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors"
              title="Start Tutorial"
            >
              <Info size={20} />
            </button>
            <div className="relative group">
              <button className="w-10 h-10 rounded-xl overflow-hidden border border-zinc-200 hover:border-zinc-400 transition-all">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                    <UserIcon size={20} />
                  </div>
                )}
              </button>
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-zinc-100 p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="px-3 py-2 border-b border-zinc-50 mb-1">
                  <p className="text-xs font-bold text-zinc-900 truncate">{user.displayName}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
                </div>
                <button 
                  onClick={() => signOut(auth)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                >
                  <X size={14} /> Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-6 space-y-6">
        {activeTab === 'forecast' && (
          <div className="space-y-6 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Simulation Active Banner */}
            {simulation.isActive && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-amber-600" />
                  <span className="text-xs font-bold text-amber-900">Simulation Mode Active</span>
                </div>
                <button 
                  onClick={() => setSimulation(s => ({ ...s, isActive: false }))}
                  className="text-[10px] font-bold text-amber-600 uppercase hover:text-amber-700"
                >
                  Deactivate
                </button>
              </div>
            )}

            {/* Financial Health Indicator */}
            <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles size={14} className="text-zinc-400" /> Financial Health
                </h3>
                <span className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded-full", financialHealth.color.replace('text-', 'bg-').replace('500', '100'), financialHealth.color)}>
                  {financialHealth.status}
                </span>
              </div>
              <p className="text-sm font-medium text-zinc-600 leading-relaxed">
                {financialHealth.explanation}
              </p>
            </div>

            {/* Goals Progress Card */}
            {goals.length > 0 && (
              <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <Target size={14} className="text-violet-500" /> {settings.language === 'pt' ? 'Objetivos Financeiros' : 'Financial Goals'}
                  </h3>
                </div>
                <div className="space-y-4">
                  {goals.filter(g => !g.is_completed).map(goal => {
                    const progress = Math.min(100, Math.max(0, (effectiveBalance / goal.target_amount) * 100));
                    const goalDate = parseISO(goal.target_date);
                    const daysLeft = Math.ceil((goalDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <div key={goal.id} className="space-y-2">
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-sm font-bold text-zinc-900">{goal.name}</p>
                            <p className="text-[10px] font-medium text-zinc-400 uppercase">
                              {daysLeft > 0 ? `${daysLeft} days left` : 'Target date reached'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-zinc-900">{formatCurrency(goal.target_amount)}</p>
                            <p className="text-[10px] font-bold text-violet-500 uppercase">{Math.round(progress)}%</p>
                          </div>
                        </div>
                        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-violet-500 rounded-full transition-all duration-1000" 
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Financial Health Section */}
            <FinancialHealth 
              settings={settings}
              forecast={forecast}
              effectiveBalance={effectiveBalance}
              forecastWeeks={forecastWeeks}
              formatCurrency={formatCurrency}
              onUpdateSettings={handleUpdateSettings}
              onOpenSettings={(type) => {
                setSettingsModalType(type);
                setIsSettingsModalOpen(true);
              }}
              smartAlerts={smartAlerts}
              t={t}
            />

            {/* Currency Converter / Remittance Card */}
            <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <ArrowRight size={14} /> {settings.language === 'pt' ? 'Conversor de Moeda' : 'Currency Converter'}
                </h3>
                <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full uppercase">
                  {settings.language === 'pt' ? 'Estimativa de Remessa' : 'Remittance Estimate'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{settings.language === 'pt' ? 'Em' : 'In'} {settings.remittance_currency}</p>
                  <p className="text-2xl font-black text-zinc-900">{formatRemittance(settings.current_balance)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{settings.language === 'pt' ? 'Taxa' : 'Rate'}</p>
                  <p className="text-sm font-bold text-zinc-600">1 {settings.currency} = {settings.exchange_rate} {settings.remittance_currency}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-zinc-100">
                <p className="text-[10px] text-zinc-500 font-medium italic">
                  * Based on your custom exchange rate in settings.
                </p>
              </div>
            </div>

            {/* AI Advisor Entry Card */}
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-6 text-white shadow-xl shadow-indigo-100 overflow-hidden relative group cursor-pointer" onClick={() => { setIsAIPanelOpen(true); if (!aiAnalysis) handleRunAIAnalysis(); }}>
              <div className="relative z-10 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-indigo-200" />
                    <h3 className="text-xs font-bold text-indigo-100 uppercase tracking-widest">AI Assistant</h3>
                  </div>
                  <h2 className="text-xl font-black tracking-tight">AI Insights</h2>
                  <p className="text-[10px] text-indigo-200 font-medium max-w-[180px]">Get smart recommendations based on your data.</p>
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
                  Analyze
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsAIPanelOpen(true); }}
                  className="bg-indigo-500/30 text-white border border-white/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-500/40 transition-colors flex items-center gap-1.5"
                >
                  <MessageSquare size={12} /> Ask AI
                </button>
              </div>
              <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-colors"></div>
            </div>

            {/* Monthly Summary Card */}
            <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <PieChart size={14} /> Monthly Summary
                </h3>
                <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full uppercase">
                  {format(new Date(), 'MMMM')}
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500 font-medium">Monthly income</span>
                  <span className="font-bold text-emerald-600">+{formatCurrency(monthlySummary.totalIncome)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500 font-medium">Fixed expenses</span>
                  <span className="font-bold text-rose-600">-{formatCurrency(monthlySummary.totalFixed)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500 font-medium">Estimated variable</span>
                  <span className="font-bold text-zinc-900">-{formatCurrency(monthlySummary.monthlyVariable)}</span>
                </div>
                {monthlySummary.extraEvents > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-500 font-medium">Extraordinary events</span>
                    <span className="font-bold text-amber-600">-{formatCurrency(monthlySummary.extraEvents)}</span>
                  </div>
                )}
                <div className="pt-3 border-t border-zinc-100 flex justify-between items-center">
                  <span className="text-xs font-bold uppercase text-zinc-900">Projected end of month balance</span>
                  <span className={cn(
                    "text-lg font-black",
                    monthlySummary.projectedRemaining < 0 ? "text-rose-600" : "text-zinc-900"
                  )}>
                    {formatCurrency(monthlySummary.projectedRemaining)}
                  </span>
                </div>
              </div>
            </div>

            {/* Currency Converter Tool */}
            <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <RotateCcw size={14} /> Currency Converter
                </h3>
              </div>
              
              <div className="space-y-4">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400">{settings.currency}</span>
                  <input 
                    type="number" 
                    placeholder="Enter amount"
                    value={converterAmount || ''}
                    onChange={(e) => setConverterAmount(Number(e.target.value))}
                    className="w-full bg-zinc-50 border-none rounded-2xl pl-14 pr-4 py-3 text-lg font-bold focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {['EUR', 'USD', 'GBP', 'BRL'].filter(c => c !== settings.currency).map(curr => (
                    <div key={curr} className="bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
                      <p className="text-[10px] text-zinc-400 font-bold uppercase">{curr}</p>
                      <p className="text-sm font-black">
                        {exchangeRates[curr] ? (converterAmount * exchangeRates[curr]).toLocaleString('en-US', { style: 'currency', currency: curr }) : '---'}
                      </p>
                    </div>
                  ))}
                </div>

                {converterAmount > 0 && (
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                    <p className="text-xs font-medium text-emerald-800 leading-relaxed">
                      "You could send approximately <strong>{formatCurrency(Math.max(0, settings.current_balance - settings.safety_threshold))}</strong> in your home currency while keeping your safety balance."
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm h-[450px] flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t.projection} {forecastWeeks} {t.weeks}</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <select 
                    onChange={(e) => {
                      const month = parseInt(e.target.value);
                      if (isNaN(month)) return;
                      const today = new Date();
                      const target = new Date(today.getFullYear(), month, 1);
                      if (target < today) target.setFullYear(today.getFullYear() + 1);
                      
                      // Find the first week in the forecast that starts in this month
                      const targetWeek = forecast.find(w => {
                        const wStart = parseISO(w.start_date);
                        return wStart.getMonth() === target.getMonth() && wStart.getFullYear() === target.getFullYear();
                      });
                      
                      if (targetWeek) {
                        if (targetWeek.week_number > forecastWeeks) {
                          setForecastWeeks(52);
                        }
                        
                        setTimeout(() => {
                          const element = document.getElementById(`week-${targetWeek.week_number}`);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }, 100);
                      }
                    }}
                    className="bg-zinc-100 border-none rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-zinc-900 transition-all shadow-sm"
                  >
                    <option value="">{t.month}...</option>
                    {Array.from({ length: 12 }).map((_, i) => {
                      const d = new Date();
                      d.setMonth(d.getMonth() + i);
                      return (
                        <option key={i} value={d.getMonth()}>
                          {format(d, 'MMM yy')}
                        </option>
                      );
                    })}
                  </select>
                  <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl shadow-sm">
                    {[12, 24, 52].map(weeks => (
                      <button
                        key={weeks}
                        onClick={() => setForecastWeeks(weeks)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                          forecastWeeks === weeks 
                            ? "bg-white text-zinc-900 shadow-sm" 
                            : "text-zinc-400 hover:text-zinc-600"
                        )}
                      >
                        {weeks === 52 ? t.year : `${weeks}W`}
                      </button>
                    ))}
                  </div>
                  <button 
                    id="simulation-button"
                    onClick={() => setIsSimPanelOpen(true)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all shadow-sm",
                      simulation.isActive 
                        ? "bg-amber-500 text-white border border-amber-600" 
                        : "bg-zinc-900 text-white hover:bg-zinc-800"
                    )}
                  >
                    <TrendingUp size={14} />
                    {simulation.isActive ? 'Sim' : t.simulate}
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <ForecastGraph 
                  forecast={forecast}
                  settings={settings}
                  goals={goals}
                  formatCurrency={formatCurrency}
                  highlightedWeek={highlightedWeek}
                  simulation={simulation}
                />
              </div>
            </div>

            {/* Forecast List */}
            <div id="weekly-timeline" className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t.timeline}</h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-zinc-900 rounded-full"></div>
                    <span className="text-[8px] font-bold text-zinc-400 uppercase">Real</span>
                  </div>
                  {simulation.isActive && (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                      <span className="text-[8px] font-bold text-zinc-400 uppercase">{settings.language === 'pt' ? 'Simulado' : 'Simulated'}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                {forecast.map((week) => (
                  <div 
                    key={week.week_number} 
                    id={`week-${week.week_number}`}
                    onClick={() => setHighlightedWeek(week.week_number)}
                    className={cn(
                      "bg-white rounded-2xl p-5 border transition-all flex items-center justify-between group cursor-pointer",
                      highlightedWeek === week.week_number 
                        ? "border-zinc-900 ring-1 ring-zinc-900 shadow-md" 
                        : (simulation.isActive ? week.is_sim_below_threshold : week.is_below_threshold) 
                          ? "border-rose-200 bg-rose-50/30 hover:border-rose-300" 
                          : "border-zinc-200 hover:border-zinc-300 shadow-sm"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-bold text-[10px] transition-colors",
                        (simulation.isActive ? week.is_sim_below_threshold : week.is_below_threshold) 
                          ? "bg-rose-100 text-rose-600" 
                          : "bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200"
                      )}>
                        <span className="uppercase opacity-50 text-[8px]">Week</span>
                        <span className="text-lg leading-none">{week.week_number}</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-900">
                          {format(parseISO(week.start_date), 'dd/MM')} - {format(parseISO(week.end_date), 'dd/MM')}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {week.incomes.length > 0 && (
                            <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-100">
                              <ArrowUpRight size={10} />
                              <span className="text-[8px] font-bold uppercase">Income</span>
                            </div>
                          )}
                          {week.events.length > 0 && (
                            <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg border border-amber-100">
                              <Calendar size={10} />
                              <span className="text-[8px] font-bold uppercase">Event</span>
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
                          <Info size={12} /> {t.details}
                        </button>
                      </div>
                      {(simulation.isActive ? week.is_sim_below_threshold : week.is_below_threshold) && (
                        <p className="text-[10px] text-rose-500 font-bold flex items-center justify-end gap-1 mt-1.5">
                          <AlertTriangle size={12} /> {settings.language === 'pt' ? 'Risco de Saldo' : 'Balance Risk'}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'setup' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Global Settings */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <SettingsIcon size={16} className="text-zinc-400" />
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t.settings}</h3>
              </div>
              <div className="bg-white rounded-3xl p-6 border border-zinc-200 space-y-6 shadow-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">{t.currency}</label>
                    <select 
                      value={settings.currency}
                      onChange={(e) => handleCurrencyChange(e.target.value)}
                      className="w-full bg-zinc-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                    >
                      {SUPPORTED_CURRENCIES.map(curr => (
                        <option key={curr.code} value={curr.code}>{curr.code} ({curr.symbol})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">{t.remittance}</label>
                    <select 
                      value={settings.remittance_currency}
                      onChange={(e) => {
                        const newRemittance = e.target.value;
                        const newRate = exchangeRates[newRemittance] || settings.exchange_rate;
                        handleSaveSettings({...settings, remittance_currency: newRemittance, exchange_rate: newRate});
                      }}
                      className="w-full bg-zinc-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                    >
                      {SUPPORTED_CURRENCIES.filter(c => c.code !== settings.currency).map(curr => (
                        <option key={curr.code} value={curr.code}>{curr.code} ({curr.symbol})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Your Name</label>
                    <input 
                      type="text" 
                      value={settings.user_name}
                      onChange={(e) => handleSaveSettings({...settings, user_name: e.target.value})}
                      className="w-full bg-zinc-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                    />
                  </div>
                  {settings.is_couple_mode && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Partner's Name</label>
                      <input 
                        type="text" 
                        value={settings.partner_name}
                        onChange={(e) => handleSaveSettings({...settings, partner_name: e.target.value})}
                        className="w-full bg-zinc-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">{t.currentBalance}</label>
                    <Wallet size={14} className="text-zinc-300" />
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400">{settings.currency}</span>
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
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">{t.weeklySpending}</label>
                    <input 
                      type="number" 
                      value={settings.weekly_spending_estimate}
                      onChange={(e) => handleSaveSettings({...settings, weekly_spending_estimate: Number(e.target.value)})}
                      className="w-full bg-zinc-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">{t.safetyLimit}</label>
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
                      <span className="text-sm font-bold block">{t.coupleMode}</span>
                      <span className="text-[10px] text-zinc-400 uppercase font-medium">{t.sharedManagement}</span>
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
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Monthly Incomes</h3>
                </div>
                <button 
                  onClick={() => { setModalType('income'); setEditingItem(null); setIsModalOpen(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-[10px] font-bold uppercase shadow-sm hover:bg-emerald-700 transition-colors"
                >
                  <Plus size={14} /> Add
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
                          <span className="text-[10px] text-zinc-400 font-medium">Day {inc.day_of_month}</span>
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
                    <p className="text-xs font-bold text-zinc-400 uppercase">No income registered</p>
                  </div>
                )}
              </div>
            </section>

            {/* Fixed Expenses */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <ArrowDownRight size={16} className="text-rose-500" />
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Fixed Expenses</h3>
                </div>
                <button 
                  onClick={() => { setModalType('expense'); setEditingItem(null); setIsModalOpen(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-xl text-[10px] font-bold uppercase shadow-sm hover:bg-rose-700 transition-colors"
                >
                  <Plus size={14} /> Add
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
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-zinc-400 font-medium">Day {exp.day_of_month}</span>
                          {settings.is_couple_mode && exp.owner && (
                            <>
                              <span className="w-1 h-1 bg-zinc-200 rounded-full"></span>
                              <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-md font-bold uppercase">{exp.owner}</span>
                            </>
                          )}
                        </div>
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
                    <p className="text-xs font-bold text-zinc-400 uppercase">No fixed expense registered</p>
                  </div>
                )}
              </div>
            </section>

            {/* Beta Info */}
            <div className="flex flex-col items-center gap-4 pt-8 pb-12">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Version: Beta 1.0.0</span>
              <button 
                onClick={() => window.open('mailto:feedback@provera.app')}
                className="flex items-center gap-2 px-6 py-3 bg-zinc-100 text-zinc-600 rounded-2xl text-xs font-bold hover:bg-zinc-200 transition-all"
              >
                <MessageSquare size={16} /> Send Feedback
              </button>
              <button 
                onClick={handleResetData}
                className="text-[10px] font-bold text-rose-500 uppercase hover:text-rose-600 transition-colors"
              >
                Reset Financial Data
              </button>
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-amber-500" />
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Future Events</h3>
              </div>
              <button 
                onClick={() => { setModalType('event'); setEditingItem(null); setIsModalOpen(true); }}
                className="bg-zinc-900 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase flex items-center gap-2 shadow-sm hover:bg-zinc-800 transition-colors"
              >
                <Plus size={14} /> New Event
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
                        <span className="text-[10px] text-zinc-400 font-medium">{format(parseISO(evt.date), 'dd MMM yyyy', { locale: enUS })}</span>
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
                  <p className="text-sm text-zinc-400 font-bold uppercase tracking-wider">No events planned</p>
                  <p className="text-[10px] text-zinc-400 mt-1">Add one-off expenses like insurance or vacations</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'goals' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-500">
            <div className="flex items-center justify-between px-1">
              <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tight text-zinc-900">{t.goals}</h2>
                <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">{t.planFuture}</p>
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
                
                // Find projected balance at target date
                const targetWeek = forecast.find(w => {
                  const wStart = parseISO(w.start_date);
                  const wEnd = parseISO(w.end_date);
                  return targetDate >= wStart && targetDate <= wEnd;
                });

                const projectedAtTarget = targetWeek ? targetWeek.projected_balance : null;
                const isOnTrack = projectedAtTarget !== null ? projectedAtTarget >= goal.target_amount : null;
                
                // Improved calculation: how much EXTRA is needed per week
                const currentReference = projectedAtTarget !== null ? projectedAtTarget : settings.current_balance;
                const deficit = Math.max(0, goal.target_amount - currentReference);
                const extraNeededPerWeek = deficit / totalWeeks;
                const baseNeededPerWeek = goal.target_amount / totalWeeks;

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
                              {t.by} {format(targetDate, 'MMMM yyyy', { locale: getDateLocale() })}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{t.goal}</p>
                            <p className="text-xl font-black text-zinc-900">{formatCurrency(goal.target_amount)}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{t.weeklySavings}</p>
                            <p className="text-xl font-black text-indigo-600">
                              ~{formatCurrency(isOnTrack ? baseNeededPerWeek : (baseNeededPerWeek + extraNeededPerWeek))}
                            </p>
                          </div>
                        </div>

                        {projectedAtTarget !== null && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{t.projectedBalanceAtDate}</p>
                              <span className={cn(
                                "text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
                                isOnTrack ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                              )}>
                                {isOnTrack ? t.onTrack : t.belowTarget}
                              </span>
                            </div>
                            <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                              <div 
                                className={cn(
                                  "h-full transition-all duration-1000",
                                  isOnTrack ? "bg-emerald-500" : "bg-rose-500"
                                )}
                                style={{ width: `${Math.min(100, (projectedAtTarget / goal.target_amount) * 100)}%` }}
                              ></div>
                            </div>
                            <p className="text-[10px] font-bold text-zinc-500">
                              {t.projection}: <span className="text-zinc-900">{formatCurrency(projectedAtTarget)}</span>
                            </p>
                          </div>
                        )}

                        {!goal.is_completed && projectedAtTarget === null && (
                          <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 flex items-center gap-3">
                            <Info size={16} className="text-indigo-500 shrink-0" />
                            <p className="text-[10px] font-bold text-indigo-700 leading-relaxed">
                              {t.goalBeyondForecast.replace('{weeks}', forecastWeeks.toString()).replace('{amount}', formatCurrency(goal.target_amount)).replace('{totalWeeks}', totalWeeks.toString()).replace('{needed}', formatCurrency(baseNeededPerWeek))}
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
                        <CheckCircle2 size={12} /> Completed
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
                  <h3 className="text-lg font-black text-zinc-900 mb-2">Define your Goals</h3>
                  <p className="text-xs text-zinc-400 font-medium max-w-[240px] mx-auto leading-relaxed">
                    Want to buy a car? Save for vacations? Set a value and a date and the assistant will help you get there.
                  </p>
                  <button 
                    onClick={() => { setModalType('goal'); setEditingItem(null); setIsModalOpen(true); }}
                    className="mt-8 bg-zinc-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-zinc-200 hover:bg-zinc-800 transition-all active:scale-95"
                  >
                    Create First Goal
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav id="setup-tabs" className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 px-6 py-3 pb-8 z-40">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button 
            onClick={() => setActiveTab('forecast')}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              activeTab === 'forecast' ? "text-zinc-900" : "text-zinc-400"
            )}
          >
            <LayoutDashboard size={24} />
            <span className="text-[10px] font-bold uppercase">{t.forecast}</span>
          </button>
          <button 
            onClick={() => setActiveTab('events')}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              activeTab === 'events' ? "text-zinc-900" : "text-zinc-400"
            )}
          >
            <Calendar size={24} />
            <span className="text-[10px] font-bold uppercase">{t.events}</span>
          </button>
          <button 
            onClick={() => setActiveTab('goals')}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              activeTab === 'goals' ? "text-zinc-900" : "text-zinc-400"
            )}
          >
            <Target size={24} />
            <span className="text-[10px] font-bold uppercase">{t.goals}</span>
          </button>
          <button 
            onClick={() => setActiveTab('setup')}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              activeTab === 'setup' ? "text-zinc-900" : "text-zinc-400"
            )}
          >
            <SettingsIcon size={24} />
            <span className="text-[10px] font-bold uppercase">{t.settings}</span>
          </button>
        </div>
      </nav>

      {/* Floating AI Button */}
      <button 
        id="ai-coach-button"
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
                  <h2 className="text-xl font-black text-amber-900 tracking-tight">Simulation Mode</h2>
                  <p className="text-[10px] text-amber-600 uppercase font-bold tracking-widest">Test hypothetical scenarios</p>
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
                    <p className="text-sm font-black text-amber-900">Activate Simulation</p>
                    <p className="text-[10px] text-amber-600 uppercase font-bold">See impact on chart</p>
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
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Change Weekly Spending</label>
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
                      +{delta} {settings.currency}
                    </button>
                  ))}
                  <button
                    onClick={() => setSimulation({ isActive: false, weeklySpendingDelta: 0, oneOffExpenses: [], incomeChanges: [] })}
                    className="py-4 rounded-2xl text-[10px] font-black bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center gap-1.5 uppercase tracking-wider hover:bg-rose-100 transition-colors"
                  >
                    <RotateCcw size={14} /> Clear
                  </button>
                </div>
              </div>

              {/* Large Purchase / One-off Expense */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <ArrowDownRight size={14} className="text-zinc-400" />
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Simulate Large Purchase</label>
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
                    <input name="description" placeholder="Ex: Laptop, Car Repair" className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
                    <div className="grid grid-cols-2 gap-3">
                      <input name="amount" type="number" placeholder="Value" className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
                      <input name="date" type="date" className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
                    </div>
                    <button type="submit" className="w-full bg-amber-500 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-200 hover:bg-amber-600 transition-all active:scale-[0.98]">
                      Add to Simulation
                    </button>
                  </form>
                  
                  <div className="space-y-2">
                    {simulation.oneOffExpenses.map((exp, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-white border border-zinc-100 rounded-2xl shadow-sm animate-in slide-in-from-right duration-300">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                          <div>
                            <p className="text-sm font-black text-zinc-900">{exp.description}</p>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase">{format(parseISO(exp.date), 'dd MMM', { locale: enUS })}</p>
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
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Simulate Extra Income</label>
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
                    <input name="description" placeholder="Ex: Bonus, Salary Increase" className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-400 transition-all" />
                    <div className="grid grid-cols-2 gap-3">
                      <input name="amount" type="number" placeholder="Value" className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-400 transition-all" />
                      <input name="date" type="date" className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-400 transition-all" />
                    </div>
                    <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-[0.98]">
                      Add to Simulation
                    </button>
                  </form>
                  
                  <div className="space-y-2">
                    {simulation.incomeChanges.map((inc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-white border border-zinc-100 rounded-2xl shadow-sm animate-in slide-in-from-right duration-300">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                          <div>
                            <p className="text-sm font-black text-zinc-900">{inc.description}</p>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase">{format(parseISO(inc.date), 'dd MMM', { locale: enUS })}</p>
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
                See Impact on Forecast
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
                    {editingItem ? 'Edit' : 'Add'} {modalType === 'income' ? 'Income' : modalType === 'expense' ? 'Fixed Expense' : modalType === 'goal' ? 'Goal' : 'Event'}
                  </h2>
                  <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">Financial Management</p>
                </div>
              </div>
              <button onClick={() => { setIsModalOpen(false); setEditingItem(null); }} className="p-2 text-zinc-400 hover:bg-zinc-100 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <form key={editingItem?.id || 'new'} onSubmit={handleAddItem} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Description</label>
                <input 
                  name={modalType === 'event' ? 'description' : 'name'} 
                  defaultValue={editingItem ? (modalType === 'event' ? editingItem.description : editingItem.name) : ''}
                  required 
                  placeholder={modalType === 'goal' ? "Ex: Buy Car, Vacation..." : "Ex: Salary, Rent, Insurance..."}
                  className="w-full bg-zinc-50 border-none rounded-2xl px-5 py-4 font-bold outline-none focus:ring-2 focus:ring-zinc-900 transition-all shadow-inner" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">
                    {modalType === 'goal' ? t.goalTarget : t.amount} ({settings.currency})
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
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">{t.day}</label>
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
                      {modalType === 'goal' ? t.goalDate : t.date}
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

              {modalType === 'event' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">{t.type}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'expense', label: t.expense_type, icon: ArrowDownRight, color: 'text-rose-600' },
                      { id: 'income', label: t.extra, icon: ArrowUpRight, color: 'text-emerald-600' }
                    ].map(item => (
                      <label key={item.id} className="relative cursor-pointer">
                        <input 
                          type="radio" 
                          name="type" 
                          value={item.id} 
                          defaultChecked={(editingItem?.type || 'expense') === item.id}
                          className="peer sr-only"
                        />
                        <div className="flex items-center gap-2 justify-center py-3 rounded-xl bg-zinc-50 border border-zinc-100 text-[10px] font-black uppercase text-zinc-400 peer-checked:bg-zinc-900 peer-checked:text-white peer-checked:border-zinc-900 transition-all">
                          <item.icon size={14} className={cn("peer-checked:text-white", item.color)} />
                          {item.label}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {modalType === 'goal' && (
                <div className="flex items-center gap-3 bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                  <input 
                    type="checkbox" 
                    name="is_completed" 
                    defaultChecked={editingItem?.is_completed}
                    className="w-5 h-5 rounded-lg border-zinc-200 text-zinc-900 focus:ring-zinc-900"
                  />
                  <label className="text-xs font-bold text-zinc-600 uppercase tracking-widest">Goal Completed</label>
                </div>
              )}

              {modalType === 'income' && settings.is_couple_mode && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Income Owner</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['me', 'partner', 'shared'].map(owner => (
                      <label key={owner} className="relative cursor-pointer">
                        <input 
                          type="radio" 
                          name="owner" 
                          value={owner} 
                          defaultChecked={(editingItem?.owner || 'shared') === owner}
                          className="peer sr-only"
                        />
                        <div className="flex items-center justify-center py-3 rounded-xl bg-zinc-50 border border-zinc-100 text-[10px] font-black uppercase text-zinc-400 peer-checked:bg-zinc-900 peer-checked:text-white peer-checked:border-zinc-900 transition-all">
                          {owner === 'me' ? settings.user_name : owner === 'partner' ? settings.partner_name : 'Both'}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {modalType === 'expense' && settings.is_couple_mode && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Expense Owner</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['me', 'partner', 'shared'].map(owner => (
                      <label key={owner} className="relative cursor-pointer">
                        <input 
                          type="radio" 
                          name="owner" 
                          value={owner} 
                          defaultChecked={(editingItem?.owner || 'shared') === owner}
                          className="peer sr-only"
                        />
                        <div className="flex items-center justify-center py-3 rounded-xl bg-zinc-50 border border-zinc-100 text-[10px] font-black uppercase text-zinc-400 peer-checked:bg-zinc-900 peer-checked:text-white peer-checked:border-zinc-900 transition-all">
                          {owner === 'me' ? settings.user_name : owner === 'partner' ? settings.partner_name : 'Both'}
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
                  <Save size={20} /> {editingItem ? 'Save Changes' : 'Add Item'}
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
          effectiveBalance={effectiveBalance}
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
            <h3 className="text-lg font-black text-zinc-900 tracking-tight">Forecast Explanation</h3>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Week {week.week_number} — {format(parseISO(week.start_date), 'dd/MM')} to {format(parseISO(week.end_date), 'dd/MM')}
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
              <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Starting Balance</p>
              <p className="text-lg font-black text-zinc-900">{formatCurrency(week.start_balance)}</p>
            </div>
            <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
              <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Ending Balance</p>
              <p className="text-lg font-black text-white">{formatCurrency(week.projected_balance)}</p>
            </div>
          </div>

          {/* Movements */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-1">Weekly Movements</h4>
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
                      <p className="text-[10px] font-medium text-zinc-400 uppercase">{m.type === 'income' ? 'Income' : m.type === 'spending' ? 'Est. Spending' : 'Expense'}</p>
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
                <p className="text-center py-4 text-sm text-zinc-400 italic">No specific movements this week.</p>
              )}
            </div>
          </div>

          {/* Warning */}
          {week.is_below_threshold && (
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="text-rose-500 shrink-0" size={20} />
              <div>
                <p className="text-sm font-bold text-rose-900">Limit Warning</p>
                <p className="text-xs text-rose-600 font-medium mt-0.5">
                  ⚠ Balance below safety limit ({formatCurrency(settings.safety_threshold)}) this week.
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
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsQuickEdit({ type, settings, effectiveBalance, onClose, onSave }: {
  type: 'balance' | 'spending' | 'threshold';
  settings: AppSettings;
  effectiveBalance: number;
  onClose: () => void;
  onSave: (s: Partial<AppSettings>) => void;
}) {
  const [value, setValue] = useState(
    type === 'balance' ? effectiveBalance :
    type === 'spending' ? settings.weekly_spending_estimate :
    settings.safety_threshold
  );

  const title = type === 'balance' ? 'Current Balance' :
                type === 'spending' ? 'Est. Weekly Spending' :
                'Safety Limit';

  const field = type === 'balance' ? 'current_balance' :
                type === 'spending' ? 'weekly_spending_estimate' :
                'safety_threshold';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-sm rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 duration-500">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <h3 className="text-lg font-black text-zinc-900 tracking-tight">Change {title}</h3>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:border-zinc-300 transition-all shadow-sm"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">New Value ({settings.currency})</label>
              <input 
                type="number" 
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                autoFocus
                className="w-full bg-zinc-50 border-none rounded-2xl px-5 py-4 text-2xl font-black outline-none focus:ring-2 focus:ring-zinc-900 transition-all shadow-inner" 
              />
              {type === 'balance' && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100 mt-2">
                  <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-bold text-amber-700 leading-tight">
                    {TRANSLATIONS[settings.language as Language]?.currencyWarning || TRANSLATIONS.en.currencyWarning}
                  </p>
                </div>
              )}
            </div>
          <button 
            onClick={() => onSave({ [field]: value })}
            className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold text-sm hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-200 flex items-center justify-center gap-2"
          >
            <Save size={18} /> Save Change
          </button>
        </div>
      </div>
    </div>
  );
}