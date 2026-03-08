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
    Act as a Personal Financial Assistant specialized in cash flow management.
    Analyze the following user financial data and provide smart insights and practical recommendations in English.

    USER DATA:
    - Current Balance: ${data.settings.current_balance} ${data.settings.currency}
    - Estimated Weekly Spending: ${data.settings.weekly_spending_estimate} ${data.settings.currency}
    - Safety Limit: ${data.settings.safety_threshold} ${data.settings.currency}
    - Couple Mode Active: ${data.settings.is_couple_mode ? 'Yes' : 'No'}
    
    FINANCIAL GOALS:
    ${data.goals.map(g => `- ${g.name}: ${g.target_amount} ${data.settings.currency} by ${g.target_date} (Completed: ${g.is_completed ? 'Yes' : 'No'})`).join('\n')}

    MONTHLY INCOMES:
    ${data.incomes.map(i => `- ${i.name}: ${i.amount} ${data.settings.currency} (Day ${i.day_of_month})`).join('\n')}
    
    FIXED EXPENSES:
    ${data.fixedExpenses.map(e => `- ${e.name}: ${e.amount} ${data.settings.currency} (Day ${e.day_of_month})`).join('\n')}
    
    FUTURE EVENTS:
    ${data.events.map(e => `- ${e.description}: ${e.amount} ${data.settings.currency} on ${e.date}`).join('\n')}
    
    12-WEEK PROJECTION (PROJECTED BALANCE):
    ${data.forecast.map(w => `- Week ${w.week_number}: ${w.projected_balance} ${data.settings.currency}`).join('\n')}
    
    ACTIVE SIMULATIONS:
    - Weekly Spending Delta: ${data.simulation.weeklySpendingDelta} ${data.settings.currency}
    - One-off Purchases: ${data.simulation.oneOffExpenses.map(e => `${e.description} (${e.amount} ${data.settings.currency})`).join(', ')}
    - Income Changes: ${data.simulation.incomeChanges.map(e => `${e.description} (${e.amount} ${data.settings.currency})`).join(', ')}

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
        { "type": "risk" | "suggestion" | "impact" | "positive", "message": "The insight here" }
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
                message: { type: Type.STRING }
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
    You are an intelligent Personal Financial Assistant. Answer questions about the user's finances based on the provided data.
    Be concise, practical, and always use English.
    If the user asks if they can buy something, analyze the impact on the 12-week future balance.
    If the user asks how much they can spend, suggest values that keep the balance above the safety limit (${data.settings.safety_threshold} ${data.settings.currency}).

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
