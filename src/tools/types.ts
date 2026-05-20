import { ToolDefinition } from "../llm/provider.js";

export interface ToolResult {
  success: boolean;
  data: string;
  error?: string;
  imagePath?: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: any; // JSON Schema Object
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

export function toToolDefinition(tool: Tool): ToolDefinition {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}
