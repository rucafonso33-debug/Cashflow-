export interface AppSettings {
  current_balance: number;
  weekly_spending_estimate: number;
  safety_threshold: number;
  is_couple_mode: boolean;
  currency: string;
  remittance_currency: string;
  exchange_rate: number;
  language: 'en' | 'pt';
  onboarding_completed: boolean;
  last_exchange_update?: string;
  balance_last_updated?: string;
}

export interface Income {
  id?: string;
  name: string;
  amount: number;
  day_of_month: number;
  owner: 'rodrigo' | 'ana' | 'shared';
}

export interface FixedExpense {
  id?: string;
  name: string;
  amount: number;
  day_of_month: number;
  owner?: 'rodrigo' | 'ana' | 'shared';
}

export interface FutureEvent {
  id?: string;
  description: string;
  amount: number;
  date: string; // ISO string
}

export interface Movement {
  name: string;
  amount: number;
  type: 'income' | 'expense' | 'spending' | 'event';
}

export interface ForecastWeek {
  week_number: number;
  start_date: string;
  end_date: string;
  start_balance: number;
  projected_balance: number;
  simulated_balance: number;
  is_below_threshold: boolean;
  is_sim_below_threshold: boolean;
  events: string[];
  incomes: string[];
  movements: Movement[];
}

export interface SimulationState {
  isActive: boolean;
  weeklySpendingDelta: number;
  oneOffExpenses: { description: string; amount: number; date: string }[];
  incomeChanges: { description: string; amount: number; date: string }[];
}

export interface AIInsight {
  type: 'risk' | 'suggestion' | 'impact' | 'positive';
  message: string;
  action?: {
    type: 'update_spending' | 'update_threshold' | 'add_event';
    value: any;
    label: string;
  };
}

export interface AIAnalysis {
  healthSummary: string;
  healthStatus: 'Moderate' | 'Good' | 'Risk';
  insights: AIInsight[];
  suggestions: string[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface FinancialGoal {
  id?: string;
  name: string;
  target_amount: number;
  target_date: string; // ISO string
  is_completed: boolean;
}
