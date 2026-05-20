# Cuiudobô

Agente de IA pessoal construído em TypeScript, operando via Telegram.
Usa o Groq como LLM principal (com fallback para OpenRouter), possui memória persistente usando SQLite e pode executar código e analisar arquivos em um ambiente seguro.

## Como começar

1.  **Instalar dependências**:
    ```bash
    npm install
    ```
2.  **Configurar variáveis de ambiente**:
    Copie o `.env.example` para `.env` e preencha com seus dados (tokens, IDs permitidos).
    ```bash
    cp .env.example .env
    ```
3.  **Executar em modo de desenvolvimento**:
    ```bash
    npm run dev
    ```

## Estrutura

-   `src/index.ts`: Ponto de entrada (inicia banco e bot).
-   `src/bot.ts`: Lógica do Telegram usando `grammy`.
-   `src/agent/`: Loop de raciocínio (ReAct) e prompts.
-   `src/llm/`: Provedores de LLM (Groq, OpenRouter).
-   `src/memory/`: Persistência de estado com SQLite (contexto e resumos).
-   `src/tools/`: Ferramentas disponíveis para o agente (data, análise de arquivos, execução de código).
-   `src/utils/`: Funções utilitárias e segurança.
