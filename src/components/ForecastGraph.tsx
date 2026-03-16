import React from 'react';
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
import { format, parseISO } from 'date-fns';
import { AppSettings, ForecastWeek, FinancialGoal } from '../types';

interface ForecastGraphProps {
  forecast: ForecastWeek[];
  settings: AppSettings;
  goals: FinancialGoal[];
  formatCurrency: (value: number) => string;
  highlightedWeek: number | null;
  simulation: any;
}

export function ForecastGraph({ forecast, settings, goals, formatCurrency, highlightedWeek, simulation }: ForecastGraphProps) {
  return (
    <div id="forecast-chart" className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <div key={forecast.length} className="w-full h-full">
          <AreaChart data={forecast} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            {highlightedWeek !== null && (
              <ReferenceLine x={forecast[highlightedWeek - 1]?.start_date} stroke="#18181b" strokeDasharray="3 3" />
            )}
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
            <XAxis 
              dataKey="start_date" 
              axisLine={false} 
              tickLine={false} 
              tick={{fontSize: 10, fill: '#a1a1aa'}} 
              tickFormatter={(val) => format(parseISO(val), 'dd/MM')}
              minTickGap={30}
            />
            <YAxis hide domain={['auto', 'auto']} padding={{ top: 20, bottom: 20 }} />
            <Tooltip 
              contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
              labelFormatter={(val) => format(parseISO(val), 'dd MMMM yyyy')}
              formatter={(val: number, name: string) => [
                formatCurrency(val), 
                name === 'projected_balance' ? 'Real' : 'Simulated'
              ]}
            />
            <ReferenceLine 
              y={settings.safety_threshold} 
              stroke="#f43f5e" 
              strokeDasharray="3 3" 
              label={{ 
                position: 'top', 
                value: settings.language === 'pt' ? 'Limite' : 'Limit', 
                fill: '#f43f5e', 
                fontSize: 10, 
                fontWeight: 'bold' 
              }} 
            />
            
            {/* Financial Goals Reference Lines */}
            {goals.filter(g => !g.is_completed).map((goal, idx) => (
              <ReferenceLine
                key={idx}
                x={goal.target_date}
                stroke="#8b5cf6"
                strokeDasharray="3 3"
                label={{
                  value: goal.name,
                  position: 'top',
                  fill: '#8b5cf6',
                  fontSize: 10,
                  fontWeight: 900,
                  className: 'uppercase tracking-widest'
                }}
              />
            ))}
  
            <Area 
              type="monotone" 
              dataKey="projected_balance" 
              stroke="#18181b" 
              strokeWidth={3} 
              fillOpacity={1} 
              fill="url(#colorBalance)" 
              animationDuration={1000}
            />
            {simulation.isActive && (
              <Area 
                type="monotone" 
                dataKey="simulated_balance" 
                stroke="#f59e0b" 
                strokeWidth={3} 
                strokeDasharray="5 5" 
                fillOpacity={1} 
                fill="url(#colorSim)" 
                animationDuration={1000}
              />
            )}
          </AreaChart>
        </div>
      </ResponsiveContainer>
    </div>
  );
}
