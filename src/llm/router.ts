import {
  LLMProvider,
  ChatMessage,
  ToolDefinition,
  LLMResponse,
} from "./provider.js";
import { GroqProvider } from "./groq.js";
import { OpenRouterProvider } from "./openrouter.js";
import { logger } from "../utils/logger.js";
import { config } from "../config.js";

export class LLMRouter implements LLMProvider {
  name = "router";
  private primary: GroqProvider;
  private fallback: OpenRouterProvider | null = null;

  constructor() {
    this.primary = new GroqProvider();
    if (config.openRouterApiKey) {
      this.fallback = new OpenRouterProvider();
    }
  }

  async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
  ): Promise<LLMResponse> {
    try {
      console.log(tools);
      return await this.primary.chat(messages, tools);
    } catch (error: any) {
      const errMessage = error?.message || String(error);
      logger.warn(`Erro no provedor primário (Groq): ${errMessage}`);

      // Fallback se for rate limit (429) ou serviço indisponível (503) ou 522
      if (
        errMessage.includes("429") ||
        errMessage.includes("503") ||
        errMessage.includes("522") ||
        errMessage.includes("rate limit")
      ) {
        if (this.fallback) {
          logger.info("Acionando provedor de fallback (OpenRouter)...");
          return await this.fallback.chat(messages, tools);
        } else {
          logger.error("Nenhum provedor de fallback configurado.");
        }
      }

      throw error;
    }
  }
}

// Exporta instância única
export const llmRouter = new LLMRouter();
