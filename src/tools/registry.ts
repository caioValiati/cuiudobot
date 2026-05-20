import { Tool, toToolDefinition } from './types.js';
import { ToolDefinition } from '../llm/provider.js';
import { logger } from '../utils/logger.js';

class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool) {
    this.tools.set(tool.name, tool);
    logger.info(`Ferramenta registrada: ${tool.name}`);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getToolDefinitions(): ToolDefinition[] {
    return this.getAllTools().map(toToolDefinition);
  }

  async executeTool(name: string, argsStr: string): Promise<string> {
    const tool = this.getTool(name);
    if (!tool) {
      return JSON.stringify({ error: `Ferramenta '${name}' não encontrada.` });
    }

    let args: Record<string, unknown> = {};
    try {
      if (argsStr) {
         args = JSON.parse(argsStr);
      }
    } catch (e) {
      return JSON.stringify({ error: 'Falha ao parsear os argumentos da ferramenta (JSON inválido).' });
    }

    try {
      logger.debug(`Executando ferramenta ${name}`, { args });
      const result = await tool.execute(args);
      if (!result.success) {
        return JSON.stringify({ error: result.error || 'Erro desconhecido ao executar a ferramenta.' });
      }
      return result.data;
    } catch (e: any) {
      logger.error(`Exceção ao executar ferramenta ${name}`, { error: e.message });
      return JSON.stringify({ error: `Exceção interna: ${e.message}` });
    }
  }
}

export const toolRegistry = new ToolRegistry();
