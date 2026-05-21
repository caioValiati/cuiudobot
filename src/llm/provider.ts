export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any; // JSON Schema
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface LLMResponse {
  content: string | null;
  tool_calls?: ToolCall[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

export interface LLMProvider {
  name: string;
  chat(messages: ChatMessage[], tools?: ToolDefinition[]): Promise<LLMResponse>;
}
