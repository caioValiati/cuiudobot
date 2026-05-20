import { memoryStore, DbMessage } from "./store.js";
import { ChatMessage, ToolCall } from "../llm/provider.js";
import { llmRouter } from "../llm/router.js";
import { logger } from "../utils/logger.js";
import { AGENT_SYSTEM_PROMPT } from "../agent/prompt.js";
import { getDb } from "./migrations.js";

export class ContextManager {
  private readonly MAX_MESSAGES_IN_CONTEXT = 20;
  private readonly TRIGGER_SUMMARY_THRESHOLD = 30;

  async getContextForLLM(userId: number): Promise<ChatMessage[]> {
    // 1. Verificar se precisamos criar um novo resumo
    await this.checkAndSummarize(userId);

    // 2. Buscar o último resumo
    const latestSummary = memoryStore.getLatestSummary(userId);

    // 3. Buscar mensagens recentes
    // Se temos um resumo, pegamos as mensagens APÓS o messages_to_id do resumo
    // Se não temos, pegamos as últimas MAX_MESSAGES_IN_CONTEXT
    let recentDbMsgs: DbMessage[] = [];
    if (latestSummary) {
      // Pegar todas as mensagens após o último resumo
      const db = getDb(); // Hack rápido para acesso direto, ideal seria adicionar no store
      const stmt = db.prepare(
        `SELECT * FROM messages WHERE user_id = ? AND id > ? ORDER BY id ASC LIMIT ?`,
      );
      recentDbMsgs = stmt.all(
        userId,
        latestSummary.messages_to_id,
        this.MAX_MESSAGES_IN_CONTEXT,
      ) as DbMessage[];
    } else {
      recentDbMsgs = memoryStore.getRecentMessages(
        userId,
        this.MAX_MESSAGES_IN_CONTEXT,
      );
    }

    // 4. Montar o array final de mensagens para o LLM
    const context: ChatMessage[] = [];

    // Prompt de sistema base
    context.push({
      role: "system",
      content: AGENT_SYSTEM_PROMPT,
    });

    // Inserir o resumo (se houver) como uma mensagem de sistema para contexto
    if (latestSummary) {
      context.push({
        role: "system",
        content: `[CONTEXTO ANTERIOR RESUMIDO]: ${latestSummary.summary}`,
      });
    }

    // Adicionar as mensagens recentes
    for (const dbMsg of recentDbMsgs) {
      let tool_calls: ToolCall[] | undefined;
      if (dbMsg.tool_calls) {
        try {
          tool_calls = JSON.parse(dbMsg.tool_calls);
        } catch (e) {}
      }

      context.push({
        role: dbMsg.role,
        content: dbMsg.content,
        tool_call_id: dbMsg.tool_call_id || undefined,
        tool_calls,
      });
    }

    return context;
  }

  private async checkAndSummarize(userId: number) {
    const latestSummary = memoryStore.getLatestSummary(userId);
    const db = getDb();

    // Contar quantas mensagens não resumidas existem
    let unsummarizedCount = 0;
    let firstUnsummarizedId = 0;

    if (latestSummary) {
      const countStmt = db.prepare(
        `SELECT COUNT(*) as c, MIN(id) as m FROM messages WHERE user_id = ? AND id > ?`,
      );
      const res = countStmt.get(userId, latestSummary.messages_to_id) as any;
      unsummarizedCount = res.c;
      firstUnsummarizedId = res.m;
    } else {
      const countStmt = db.prepare(
        `SELECT COUNT(*) as c, MIN(id) as m FROM messages WHERE user_id = ?`,
      );
      const res = countStmt.get(userId) as any;
      unsummarizedCount = res.c;
      firstUnsummarizedId = res.m;
    }

    if (unsummarizedCount >= this.TRIGGER_SUMMARY_THRESHOLD) {
      logger.info(
        `Limpando janela de contexto do usuário ${userId}. Gerando resumo...`,
      );

      // Busca as mensagens que serão resumidas (vamos deixar as últimas 5 fora do resumo para manter fluidez)
      const msgsToSummarize = unsummarizedCount - 5;

      // Busca ID da última mensagem que será resumida
      const limitStmt = db.prepare(
        `SELECT id FROM messages WHERE user_id = ? AND id >= ? ORDER BY id ASC LIMIT 1 OFFSET ?`,
      );
      const resLimit = limitStmt.get(
        userId,
        firstUnsummarizedId,
        msgsToSummarize - 1,
      ) as any;

      if (!resLimit) return;
      const lastIdToSummarize = resLimit.id;

      // Pega o conteúdo para resumir
      const msgs = memoryStore.getMessagesBetween(
        userId,
        firstUnsummarizedId,
        lastIdToSummarize,
      );

      const chatLog = msgs
        .map(
          (m) =>
            `${m.role.toUpperCase()}: ${m.tool_calls ? "[Chamou Ferramenta]" : m.content}`,
        )
        .join("\n");

      const prompt = `Resuma a seguinte conversa entre um usuário e um assistente de IA. O resumo deve ser conciso (1 parágrafo), manter o contexto chave, decisões tomadas, e dados importantes. Foque no que a IA precisa lembrar.\n\nConversa:\n${chatLog}`;

      try {
        const response = await llmRouter.chat([
          { role: "user", content: prompt },
        ]);

        const summaryText = response.content || "Resumo falhou.";

        // Se já existia um resumo, podemos concatenar ou o LLM poderia ter recebido o resumo antigo
        // Para simplificar, salvaremos apenas o novo resumo (que idealmente deveria incluir o antigo se quisermos compressão infinita)
        // Uma melhoria futura é enviar o latestSummary junto no prompt acima.

        memoryStore.saveSummary(
          userId,
          summaryText,
          firstUnsummarizedId,
          lastIdToSummarize,
        );
        logger.info(`Resumo criado com sucesso para usuário ${userId}`);
      } catch (e) {
        logger.error(`Falha ao gerar resumo para usuário ${userId}`, e);
      }
    }
  }
}

export const contextManager = new ContextManager();
