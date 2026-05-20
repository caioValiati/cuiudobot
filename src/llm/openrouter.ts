import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { LLMProvider, ChatMessage, ToolDefinition, LLMResponse } from './provider.js';

export class OpenRouterProvider implements LLMProvider {
  name = 'openrouter';
  private apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
  private model: string;

  constructor() {
    this.model = config.openRouterModel;
  }

  async chat(messages: ChatMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    if (!config.openRouterApiKey) {
      throw new Error('OPENROUTER_API_KEY não configurada');
    }

    logger.debug(`[OpenRouter] Enviando requisição para ${this.model}`, { messagesCount: messages.length });

    const body: any = {
      model: this.model,
      messages: messages,
      temperature: 0.1,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/cuiudobo', // Recomendado pelo OpenRouter
        'X-Title': 'Cuiudobô Agent',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenRouter API Error: ${response.status} - ${text}`);
    }

    const data = await response.json();
    const choice = data.choices[0];

    const result: LLMResponse = {
      content: choice.message.content || null,
      usage: data.usage ? {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
      } : undefined
    };

    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      result.tool_calls = choice.message.tool_calls.map((tc: any) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        }
      }));
    }

    return result;
  }
}
