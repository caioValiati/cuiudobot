import { initDatabase } from './memory/migrations.js';
import { logger } from './utils/logger.js';
import { bot } from './bot.js';
import { toolRegistry } from './tools/registry.js';
import { getTimeTool } from './tools/get-time.js';
import { executePythonTool } from './tools/code-exec.js';
import { analyzeFileTool } from './tools/file-analysis.js';

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
});

async function bootstrap() {
  try {
    logger.info('Iniciando o sistema Cuiudobô...');

    // 1. Iniciar Banco de Dados
    initDatabase();

    // 2. Registrar Ferramentas
    toolRegistry.register(getTimeTool);
    toolRegistry.register(executePythonTool);
    toolRegistry.register(analyzeFileTool);

    // 3. Iniciar Bot
    logger.info('Iniciando conexão com Telegram (Long Polling)...');
    
    // Inicia o bot, ignora promessa pendente para tratarmos shutdown
    bot.start({
      onStart: (botInfo) => {
        logger.info(`Bot do Telegram logado como @${botInfo.username}`);
      },
      drop_pending_updates: true // ignora msgs antigas ao reiniciar
    });

  } catch (error: any) {
    logger.error('Falha crítica ao iniciar o sistema', { error: error.message });
    process.exit(1);
  }
}

// Tratamento de desligamento gracioso (Graceful Shutdown)
function shutdown(signal: string) {
  logger.info(`Recebido sinal de desligamento (${signal}). Encerrando bot...`);
  bot.stop().then(() => {
    logger.info('Bot encerrado.');
    process.exit(0);
  });
  
  // Timeout de segurança se demorar muito
  setTimeout(() => {
    logger.warn('Forçando encerramento após timeout.');
    process.exit(1);
  }, 5000);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

bootstrap();
