import { GoogleGenAI, Type } from "@google/genai";
import { AppSettings, Income, FixedExpense, FutureEvent, ForecastWeek, SimulationState, AIAnalysis, FinancialGoal } from "../types";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateFinancialAnalysis = async (data: {
  settings: AppSettings;
  incomes: Income[];
  fixedExpenses: FixedExpense[];
  events: FutureEvent[];
  forecast: ForecastWeek[];
  simulation: SimulationState;
  goals: FinancialGoal[];
}): Promise<AIAnalysis> => {
  const ai = getAI();
  const prompt = `
    Act as Provera, a world-class Personal Financial Coach and Wealth Manager.
    Your goal is to help the user achieve financial freedom by providing deep insights into their cash flow.
    Analyze the following user financial data and provide strategic recommendations in English.

    USER CONTEXT:
    - Current Balance: ${data.settings.current_balance} ${data.settings.currency}
    - Weekly Spending Estimate: ${data.settings.weekly_spending_estimate} ${data.settings.currency}
    - Safety Threshold (Emergency Fund Goal): ${data.settings.safety_threshold} ${data.settings.currency}
    - Couple Mode: ${data.settings.is_couple_mode ? 'Active' : 'Inactive'}
    
    FINANCIAL GOALS:
    ${data.goals.length > 0 
      ? data.goals.map(g => `- ${g.name}: Target ${g.target_amount} ${data.settings.currency} by ${g.target_date} (Status: ${g.is_completed ? 'Completed' : 'In Progress'})`).join('\n')
      : 'No specific goals set yet. Suggest setting some (e.g., Travel, Investment, Emergency Fund).'}

    MONTHLY INCOMES:
    ${data.incomes.map(i => `- ${i.name}: ${i.amount} ${data.settings.currency} (Day ${i.day_of_month})`).join('\n')}
    
    FIXED EXPENSES:
    ${data.fixedExpenses.map(e => `- ${e.name}: ${e.amount} ${data.settings.currency} (Day ${e.day_of_month})`).join('\n')}
    
    UPCOMING EVENTS:
    ${data.events.map(e => `- ${e.description}: ${e.amount} ${data.settings.currency} on ${e.date}`).join('\n')}
    
    12-WEEK PROJECTION:
    ${data.forecast.map(w => `- Week ${w.week_number}: Projected ${w.projected_balance} ${data.settings.currency}`).join('\n')}
    
    SIMULATION IMPACT:
    ${data.simulation.isActive 
      ? `User is testing: ${data.simulation.weeklySpendingDelta} change in weekly spending, plus ${data.simulation.oneOffExpenses.length} simulated expenses.`
      : 'No simulation active.'}

    COACHING DIRECTIVES:
    1. Assess Financial Health: 'Good' if balance > safety threshold for 12 weeks. 'Moderate' if it dips slightly. 'Risk' if it falls significantly below.
    2. Goal Feasibility: Calculate if the user can reach their goals based on the 'projected remaining' monthly cash flow.
    3. Optimization: Suggest specific cuts or adjustments to reach goals faster.
    4. Risk Mitigation: Identify weeks with high risk and suggest moving events or reducing spending.
    5. Encouragement: Be professional yet motivating.

    INSTRUCTIONS:
    1. Evaluate financial health (Good, Moderate, or Risk).
    2. Identify balance risks (if balance falls below safety limit).
    3. Analyze if the user is on track to reach their FINANCIAL GOALS.
    4. Suggest savings based on weekly spending to help reach goals.
    5. Analyze the impact of future events on goals.
    6. Provide positive feedback if management is solid.
    
    Respond EXCLUSIVELY in JSON format with the following structure:
    {
      "healthSummary": "A short sentence summarizing the situation",
      "healthStatus": "Good" | "Moderate" | "Risk",
      "insights": [
        { 
          "type": "risk" | "suggestion" | "impact" | "positive", 
          "message": "The insight here",
          "action": {
            "type": "update_spending" | "update_threshold" | "add_event",
            "value": any,
            "label": "Button Label (e.g., 'Reduce spending to 400')"
          }
        }
      ],
      "suggestions": ["Practical suggestion 1", "Practical suggestion 2"]
    }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          healthSummary: { type: Type.STRING },
          healthStatus: { type: Type.STRING, enum: ["Good", "Moderate", "Risk"] },
          insights: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ["risk", "suggestion", "impact", "positive"] },
                message: { type: Type.STRING },
                action: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING, enum: ["update_spending", "update_threshold", "add_event"] },
                    value: { type: Type.NUMBER },
                    label: { type: Type.STRING }
                  },
                  required: ["type", "value", "label"]
                }
              },
              required: ["type", "message"]
            }
          },
          suggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["healthSummary", "healthStatus", "insights", "suggestions"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const askFinancialQuestion = async (
  question: string,
  data: any,
  history: { role: 'user' | 'model'; text: string }[]
): Promise<string> => {
  const systemInstruction = `
    You are Provera, a highly intelligent and professional Personal Financial Coach. 
    Your tone is encouraging, data-driven, and strategic.
    Answer questions about the user's finances based on the provided data.
    Be concise, practical, and always use English.
    
    If the user asks if they can buy something, analyze the impact on the 12-week future balance and their financial goals.
    If the user asks how much they can spend, suggest values that keep the balance above the safety threshold (${data.settings.safety_threshold} ${data.settings.currency}).
    Always look for ways to optimize their cash flow.

    CURRENT DATA:
    ${JSON.stringify(data, null, 2)}
  `;

  const ai = getAI();
  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction,
    },
    history: history.map(h => ({
      role: h.role,
      parts: [{ text: h.text }]
    }))
  });

  const response = await chat.sendMessage({ message: question });
  return response.text || "Sorry, I couldn't process your question.";
};
