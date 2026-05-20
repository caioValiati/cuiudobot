import { Bot, Context, NextFunction } from 'grammy';
import { config } from './config.js';
import { isAllowedUser, sanitizeInput } from './utils/security.js';
import { logger } from './utils/logger.js';
import { runAgent } from './agent/loop.js';
import { memoryStore } from './memory/store.js';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export const bot = new Bot(config.telegramBotToken);

// Middleware de Segurança: Whitelist
bot.use(async (ctx: Context, next: NextFunction) => {
  const userId = ctx.from?.id;
  if (!userId || !isAllowedUser(userId)) {
    logger.warn(`Acesso negado para usuário ID: ${userId}`);
    return; // Ignora silenciosamente mensagens de não autorizados
  }
  await next();
});

// Comandos
bot.command('start', async (ctx) => {
  await ctx.reply('Olá! Eu sou o Cuiudobô, seu assistente pessoal de IA. Como posso ajudar você hoje?');
});

bot.command('clear', async (ctx) => {
  const userId = ctx.from!.id;
  memoryStore.clearUserMemory(userId);
  await ctx.reply('Minha memória do nosso contexto foi limpa. Começaremos do zero! 🧹');
});

bot.command('help', async (ctx) => {
  const helpText = `
*Cuiudobô Ajuda*
- Envie qualquer mensagem para conversar comigo.
- Envie um arquivo PDF ou CSV para eu analisar.
- Posso executar código Python e fazer contas matemáticas complexas.

Comandos:
/start - Iniciar
/clear - Limpar memória/contexto
/help  - Ajuda
  `;
  await ctx.reply(helpText, { parse_mode: 'Markdown' });
});

// Handler de Mensagens de Texto
bot.on('message:text', async (ctx) => {
  const userId = ctx.from.id;
  const rawText = ctx.message.text;
  const text = sanitizeInput(rawText);

  if (!text.trim()) return;

  const onThink = () => {
    ctx.replyWithChatAction('typing').catch(() => {});
  };

  try {
    const answer = await runAgent(userId, text, onThink);
    await ctx.reply(answer);
  } catch (e: any) {
    logger.error('Erro ao processar mensagem', { error: e.message, userId });
    await ctx.reply(`Ocorreu um erro ao processar sua mensagem: ${e.message}`);
  }
});

// Handler de Documentos (PDF, CSV)
bot.on('message:document', async (ctx) => {
  const userId = ctx.from.id;
  const doc = ctx.message.document;
  
  if (!doc) return;
  
  const fileName = doc.file_name || 'arquivo';
  const fileSize = doc.file_size || 0;
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  
  if (fileSize > MAX_SIZE) {
    await ctx.reply(`O arquivo é muito grande (${(fileSize / 1024 / 1024).toFixed(2)}MB). O limite é 10MB.`);
    return;
  }
  
  await ctx.replyWithChatAction('typing');
  const msg = await ctx.reply('Baixando arquivo para análise...');
  
  try {
    const file = await ctx.api.getFile(doc.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${config.telegramBotToken}/${file.file_path}`;
    
    // Download do arquivo
    const response = await fetch(fileUrl);
    const buffer = await response.arrayBuffer();
    
    // Garante que o diretório de uploads existe
    const uploadDir = join(process.cwd(), 'uploads');
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }
    
    const filePath = join(uploadDir, `${Date.now()}_${fileName}`);
    const fs = await import('fs');
    fs.writeFileSync(filePath, Buffer.from(buffer));
    
    // Passa para o agente pedindo para ele analisar
    // Simula uma mensagem do usuário mas injeta a tool command
    const agentPrompt = `Acabei de fazer o upload do arquivo '${fileName}'. Por favor, use a ferramenta 'analyze_file' para analisar o conteúdo deste arquivo no caminho '${filePath}'.`;
    
    const onThink = () => {
      ctx.replyWithChatAction('typing').catch(() => {});
    };
    
    // Atualiza status
    await ctx.api.editMessageText(ctx.chat.id, msg.message_id, 'Analisando o conteúdo...');
    
    const answer = await runAgent(userId, agentPrompt, onThink);
    
    await ctx.reply(answer);
  } catch (e: any) {
    logger.error('Erro ao processar documento', { error: e.message });
    await ctx.reply(`Falha ao baixar/analisar o arquivo: ${e.message}`);
  }
});
