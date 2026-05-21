import { logger } from "../utils/logger.js";
import { llmRouter } from "../llm/router.js";
import { toolRegistry } from "../tools/registry.js";
import { contextManager } from "../memory/context.js";
import { memoryStore } from "../memory/store.js";
import { ChatMessage, ToolDefinition } from "../llm/provider.js";
import { calculateCostBRL } from "../utils/cost.js";

const MAX_ITERATIONS = 7;

export async function runAgent(
  userId: number,
  userMessage: string,
  onThinkStatus: () => void,
): Promise<string> {
  logger.info(`Iniciando Agent Loop para usuário ${userId}`);

  // Salva mensagem do usuário na memória
  memoryStore.saveMessage(userId, {
    role: "user",
    content: userMessage,
  });

  // Notifica UI (Telegram) que estamos "digitando/pensando"
  onThinkStatus();

  // 1. Pega contexto inicial
  let messages = await contextManager.getContextForLLM(userId);
  const tools = toolRegistry.getToolDefinitions();

  let iteration = 0;
  let finalAnswer: string | null = null;

  // Rastreadores de Token
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  while (iteration < MAX_ITERATIONS && finalAnswer === null) {
    iteration++;
    logger.debug(`Iteração ${iteration}/${MAX_ITERATIONS}`);
    onThinkStatus(); // renova o status de digitando

    try {
      const response = await llmRouter.chat(messages, tools);

      // Contabiliza tokens
      if (response.usage) {
        totalPromptTokens += response.usage.prompt_tokens;
        totalCompletionTokens += response.usage.completion_tokens;
      }

      // Se tiver tool calls, executamos as ferramentas
      if (response.tool_calls && response.tool_calls.length > 0) {
        // 1. Salva a requisição de tool do assistant no histórico em memória
        const toolCallMsg: ChatMessage = {
          role: "assistant",
          content: response.content || "",
          tool_calls: response.tool_calls,
        };
        memoryStore.saveMessage(userId, toolCallMsg);
        messages.push(toolCallMsg);

        // 2. Executa cada ferramenta e adiciona o resultado
        for (const tc of response.tool_calls) {
          logger.info(`Executando ferramenta: ${tc.function.name}`);

          const resultStr = await toolRegistry.executeTool(
            tc.function.name,
            tc.function.arguments,
          );

          const toolResultMsg: ChatMessage = {
            role: "tool",
            content: resultStr,
            name: tc.function.name,
            tool_call_id: tc.id,
          };

          // Salva resultado na memória e adiciona ao contexto local
          memoryStore.saveMessage(userId, toolResultMsg);
          messages.push(toolResultMsg);
        }
        // Continua o loop para o LLM observar os resultados
      } else {
        // Não há tool calls, é a resposta final
        finalAnswer = response.content || "Não tenho uma resposta para isso.";

        // Salva resposta final
        memoryStore.saveMessage(userId, {
          role: "assistant",
          content: finalAnswer,
        });
      }
    } catch (e: any) {
      logger.error("Erro no agent loop", { error: e.message });
      finalAnswer = `Ocorreu um erro interno: ${e.message}`;
      memoryStore.saveMessage(userId, {
        role: "assistant",
        content: finalAnswer,
      });
      break;
    }
  }

  if (iteration >= MAX_ITERATIONS && !finalAnswer) {
    logger.warn("Agent loop atingiu limite máximo de iterações");
    finalAnswer =
      "Desculpe, precisei pensar demais para resolver isso e atingi meu limite. Pode reformular a pergunta?";
    memoryStore.saveMessage(userId, {
      role: "assistant",
      content: finalAnswer,
    });
  }

  // Anexa o custo à mensagem final
  const costBRL = calculateCostBRL("llama-3.3-70b-versatile", totalPromptTokens, totalCompletionTokens);
  const formattedCost = costBRL.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  const finalAnswerWithCost = `${finalAnswer}\n\n---\n💸 Custo: R$ ${formattedCost}`;

  return finalAnswerWithCost;
}
