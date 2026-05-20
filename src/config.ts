import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

// Carrega variáveis do arquivo .env
dotenvConfig({ path: resolve(process.cwd(), '.env') });

export interface Config {
  telegramBotToken: string;
  telegramAllowedUserIds: number[];
  groqApiKey: string;
  openRouterApiKey: string;
  openRouterModel: string;
  dbPath: string;
}

export function loadConfig(): Config {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!telegramBotToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is missing in .env');
  }

  const allowedUserIdsStr = process.env.TELEGRAM_ALLOWED_USER_IDS;
  if (!allowedUserIdsStr) {
    throw new Error('TELEGRAM_ALLOWED_USER_IDS is missing in .env');
  }

  const telegramAllowedUserIds = allowedUserIdsStr
    .split(',')
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => !isNaN(id));

  if (telegramAllowedUserIds.length === 0) {
    throw new Error('TELEGRAM_ALLOWED_USER_IDS must contain valid numeric IDs');
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    throw new Error('GROQ_API_KEY is missing in .env');
  }

  return {
    telegramBotToken,
    telegramAllowedUserIds,
    groqApiKey,
    openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
    openRouterModel: process.env.OPENROUTER_MODEL || 'openrouter/free',
    dbPath: process.env.DB_PATH || './memory.db',
  };
}

// Configuração estática instanciada no carregamento
export const config = loadConfig();
