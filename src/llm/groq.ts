import Groq from "groq-sdk";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import {
  LLMProvider,
  ChatMessage,
  ToolDefinition,
  LLMResponse,
} from "./provider.js";

export class GroqProvider implements LLMProvider {
  name = "groq";
  private client: Groq;
  private model = "openai/gpt-oss-120b";

  constructor() {
    this.client = new Groq({ apiKey: config.groqApiKey });
  }

  async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
  ): Promise<LLMResponse> {
    logger.debug(`[Groq] Enviando requisição para ${this.model}`, {
      messagesCount: messages.length,
    });

    const params: any = {
      messages: messages as any, // Mapeamento é quase 1:1 com OpenAI format
      model: this.model,
      temperature: 0.1, // Baixa temp para o agente ser mais focado no raciocínio
    };

    if (tools && tools.length > 0) {
      params.tools = tools;
      params.tool_choice = "auto";
    }

    const response = await this.client.chat.completions.create(params);
    const choice = response.choices[0];

    const result: LLMResponse = {
      content: choice.message.content || null,
      usage: response.usage
        ? {
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
          }
        : undefined,
    };

    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      result.tool_calls = choice.message.tool_calls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));
    }

    return result;
  }
}
