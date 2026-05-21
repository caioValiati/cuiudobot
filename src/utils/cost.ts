export interface Pricing {
  promptTokenPrice: number; // USD per 1M tokens
  completionTokenPrice: number; // USD per 1M tokens
}

// Preços baseados na API da Groq para o modelo LLaMA 3.3 70B (Valores aproximados)
export const MODEL_PRICING: Record<string, Pricing> = {
  'llama-3.3-70b-versatile': {
    promptTokenPrice: 0.59,
    completionTokenPrice: 0.79,
  },
  'openrouter/free': {
    promptTokenPrice: 0,
    completionTokenPrice: 0,
  }
};

const BRL_EXCHANGE_RATE = 5.50;

/**
 * Calcula o custo estimado da requisição em Reais (BRL).
 */
export function calculateCostBRL(model: string, promptTokens: number, completionTokens: number): number {
  // Se não encontrar o modelo, tenta fallback para o preço do LLaMA ou considera 0
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['llama-3.3-70b-versatile'];
  
  const costUSD = 
    (promptTokens / 1_000_000) * pricing.promptTokenPrice + 
    (completionTokens / 1_000_000) * pricing.completionTokenPrice;

  return costUSD * BRL_EXCHANGE_RATE;
}
