import { Tool, ToolResult } from './types.js';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { parse } from 'csv-parse/sync';
import { logger } from '../utils/logger.js';

export const analyzeFileTool: Tool = {
  name: 'analyze_file',
  description: 'Analisa o conteúdo de um arquivo que o usuário enviou. Retorna o texto extraído (PDF) ou um resumo dos dados (CSV). Você deve receber o filePath do sistema ao lidar com mensagens de documento.',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'O caminho absoluto para o arquivo local que deve ser analisado.',
      },
      fileType: {
         type: 'string',
         description: 'A extensão ou tipo do arquivo (pdf, csv, txt)',
      }
    },
    required: ['filePath'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
    const { filePath, fileType } = args;

    if (typeof filePath !== 'string') {
      return { success: false, data: '', error: 'filePath inválido.' };
    }

    if (!existsSync(filePath)) {
       return { success: false, data: '', error: 'Arquivo não encontrado no sistema.' };
    }

    try {
      const buffer = readFileSync(filePath);
      const lowerType = (typeof fileType === 'string' ? fileType : filePath).toLowerCase();
      let extractedContent = '';

      if (lowerType.endsWith('pdf') || lowerType.includes('pdf')) {
        const data = await pdfParse(buffer);
        extractedContent = data.text;
      } else if (lowerType.endsWith('csv') || lowerType.includes('csv')) {
        const records = parse(buffer, {
           columns: true,
           skip_empty_lines: true,
           relax_quotes: true
        });
        
        if (records.length === 0) {
            extractedContent = 'CSV Vazio';
        } else {
            const columns = Object.keys(records[0]).join(', ');
            const sample = records.slice(0, 5).map((r: any) => JSON.stringify(r)).join('\n');
            extractedContent = `Colunas: ${columns}\nTotal de linhas: ${records.length}\n\nAmostra (5 primeiras linhas):\n${sample}`;
        }
      } else {
        // Tenta ler como texto puro
        extractedContent = buffer.toString('utf-8');
      }

      // Trunca o conteúdo para não estourar o limite de tokens do LLM
      const MAX_LENGTH = 15000;
      if (extractedContent.length > MAX_LENGTH) {
        extractedContent = extractedContent.substring(0, MAX_LENGTH) + '\n\n...[Conteúdo truncado devido ao tamanho excessivo]';
      }

      // Envolve o conteúdo em tags XML para criar uma barreira clara no prompt do LLM
      extractedContent = `<file_data>\n${extractedContent}\n</file_data>`;

      // Deleta o arquivo após análise
      try {
        unlinkSync(filePath);
      } catch (e) {
        logger.warn('Falha ao deletar arquivo analisado', { filePath });
      }

      return {
        success: true,
        data: extractedContent,
      };
    } catch (e: any) {
      logger.error('Erro ao analisar arquivo', { error: e.message, filePath });
      return {
        success: false,
        data: '',
        error: `Falha na leitura/parse do arquivo: ${e.message}`,
      };
    }
  },
};
