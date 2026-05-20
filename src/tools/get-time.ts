import { Tool, ToolResult } from './types.js';

export const getTimeTool: Tool = {
  name: 'get_current_time',
  description: 'Retorna a data e hora atual do sistema. Útil quando o usuário pergunta que horas são, a data de hoje, ou precisa de referência temporal.',
  parameters: {
    type: 'object',
    properties: {
      timezone: {
        type: 'string',
        description: 'Opcional. Fuso horário (ex: America/Sao_Paulo). Padrão é America/Sao_Paulo.',
      },
    },
    required: [],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
    try {
      const tz = typeof args.timezone === 'string' ? args.timezone : 'America/Sao_Paulo';
      
      const now = new Date();
      const formatted = new Intl.DateTimeFormat('pt-BR', {
        timeZone: tz,
        dateStyle: 'full',
        timeStyle: 'long',
      }).format(now);

      return {
        success: true,
        data: JSON.stringify({
          currentTime: formatted,
          timezone: tz,
          unixTimestamp: Math.floor(now.getTime() / 1000),
        }),
      };
    } catch (e: any) {
      return {
        success: false,
        data: '',
        error: `Falha ao obter hora: ${e.message}`,
      };
    }
  },
};
