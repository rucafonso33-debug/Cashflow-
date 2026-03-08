import { GoogleGenAI, Type } from "@google/genai";
import { AppSettings, Income, FixedExpense, FutureEvent, ForecastWeek, SimulationState, AIAnalysis, FinancialGoal } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const generateFinancialAnalysis = async (data: {
  settings: AppSettings;
  incomes: Income[];
  fixedExpenses: FixedExpense[];
  events: FutureEvent[];
  forecast: ForecastWeek[];
  simulation: SimulationState;
  goals: FinancialGoal[];
}): Promise<AIAnalysis> => {
  const prompt = `
    Aja como um Assistente Financeiro Pessoal especializado em gestão de fluxo de caixa.
    Analise os seguintes dados financeiros do utilizador e forneça insights inteligentes e recomendações práticas em Português.

    DADOS DO UTILIZADOR:
    - Saldo Atual: ${data.settings.current_balance} CHF
    - Gasto Semanal Estimado: ${data.settings.weekly_spending_estimate} CHF
    - Limite de Segurança: ${data.settings.safety_threshold} CHF
    - Modo Casal Ativo: ${data.settings.is_couple_mode ? 'Sim' : 'Não'}
    
    METAS FINANCEIRAS:
    ${data.goals.map(g => `- ${g.name}: ${g.target_amount} CHF até ${g.target_date} (Concluída: ${g.is_completed ? 'Sim' : 'Não'})`).join('\n')}

    RECEITAS MENSAIS:
    ${data.incomes.map(i => `- ${i.name}: ${i.amount} CHF (Dia ${i.day_of_month})`).join('\n')}
    
    DESPESAS FIXAS:
    ${data.fixedExpenses.map(e => `- ${e.name}: ${e.amount} CHF (Dia ${e.day_of_month})`).join('\n')}
    
    EVENTOS FUTUROS:
    ${data.events.map(e => `- ${e.description}: ${e.amount} CHF em ${e.date}`).join('\n')}
    
    PROJEÇÃO DE 12 SEMANAS (SALDO PREVISTO):
    ${data.forecast.map(w => `- Semana ${w.week_number}: ${w.projected_balance} CHF`).join('\n')}
    
    SIMULAÇÕES ATIVAS:
    - Delta Gasto Semanal: ${data.simulation.weeklySpendingDelta} CHF
    - Compras Pontuais: ${data.simulation.oneOffExpenses.map(e => `${e.description} (${e.amount} CHF)`).join(', ')}
    - Mudanças de Rendimento: ${data.simulation.incomeChanges.map(e => `${e.description} (${e.amount} CHF)`).join(', ')}

    INSTRUÇÕES:
    1. Avalie a saúde financeira (Boa, Moderada ou Risco).
    2. Identifique riscos de saldo (se o saldo ficar abaixo do limite de segurança).
    3. Analise se o utilizador está no caminho certo para atingir as suas METAS FINANCEIRAS.
    4. Sugira poupanças baseadas no gasto semanal para ajudar a atingir as metas.
    5. Analise o impacto de eventos futuros nas metas.
    6. Dê feedback positivo se a gestão estiver sólida.
    
    Responda EXCLUSIVAMENTE em formato JSON com a seguinte estrutura:
    {
      "healthSummary": "Uma frase curta resumindo a situação",
      "healthStatus": "Boa" | "Moderada" | "Risco",
      "insights": [
        { "type": "risk" | "suggestion" | "impact" | "positive", "message": "O insight aqui" }
      ],
      "suggestions": ["Sugestão prática 1", "Sugestão prática 2"]
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
          healthStatus: { type: Type.STRING, enum: ["Boa", "Moderada", "Risco"] },
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
    És um Assistente Financeiro Pessoal inteligente. Responde a perguntas sobre as finanças do utilizador com base nos dados fornecidos.
    Sê conciso, prático e usa sempre Português de Portugal.
    Se o utilizador perguntar se pode comprar algo, analisa o impacto no saldo futuro de 12 semanas.
    Se o utilizador perguntar quanto pode gastar, sugere valores que mantenham o saldo acima do limite de segurança (${data.settings.safety_threshold} CHF).

    DADOS ATUAIS:
    ${JSON.stringify(data, null, 2)}
  `;

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
  return response.text || "Desculpe, não consegui processar a sua pergunta.";
};
