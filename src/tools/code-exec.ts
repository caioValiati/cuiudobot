import { Tool, ToolResult } from "./types.js";
import { execFile } from "child_process";
import { promisify } from "util";
import { hasDangerousPythonImports } from "../utils/security.js";
import { logger } from "../utils/logger.js";
import { writeFileSync, existsSync, mkdirSync, rmSync } from "fs"; // rmSync é ótimo para apagar pastas
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

const execFileAsync = promisify(execFile);

export const executePythonTool: Tool = {
  name: "execute_python",
  description: `Executa código Python 3 em um sandbox básico. Útil para cálculos, processamento de dados e gráficos. 
  REGRAS:
  1. O resultado de texto deve ser impresso com print().
  2. Se você gerar um gráfico (ex: matplotlib), você DEVE salvá-mo com o comando: plt.savefig('plot.png').
  3. Não permite interações de rede ou imports de sistema (os, sys, etc).`,
  parameters: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "O código fonte em Python a ser executado.",
      },
    },
    required: ["code"],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
    const code = args.code;

    if (typeof code !== "string") {
      return {
        success: false,
        data: "",
        error: "O parâmetro code deve ser uma string",
      };
    }

    if (hasDangerousPythonImports(code)) {
      logger.warn(
        "Tentativa de execução de código Python com imports bloqueados",
        { code },
      );
      return {
        success: false,
        data: "",
        error:
          "Security Error: Uso de módulos restritos não é permitido no sandbox.",
      };
    }

    // Cria um diretório de trabalho isolado para esta execução
    const runId = randomUUID();
    const workDir = join(tmpdir(), `py_exec_${runId}`);
    mkdirSync(workDir, { recursive: true });

    const tmpScript = join(workDir, "script.py");
    const expectedImagePath = join(workDir, "plot.png");

    try {
      writeFileSync(tmpScript, code, "utf-8");

      // Aponte para o executável do Python DENTRO do seu ambiente virtual
      // Altere o caminho abaixo dependendo de onde o venv está e do sistema operacional
      const pythonExecutable =
        process.platform === "win32"
          ? join(process.cwd(), "src", "tools", "venv", "Scripts", "python.exe")
          : join(process.cwd(), "src", "tools", "venv", "bin", "python");

      const { stdout, stderr } = await execFileAsync(
        pythonExecutable,
        [tmpScript],
        {
          timeout: 10000,
          maxBuffer: 10 * 1024,
          cwd: workDir, // <- IMPORTANTE: Faz o Python rodar DENTRO da pasta isolada
        },
      );

      let output = stdout;
      if (stderr) output += `\n[STDERR]\n${stderr}`;
      if (output.length > 4000)
        output = output.substring(0, 4000) + "\n...[output truncado]";

      // Verifica se o script gerou a imagem 'plot.png' que pedimos na description
      const generatedImage = existsSync(expectedImagePath)
        ? expectedImagePath
        : undefined;

      return {
        success: true,
        data: output || "Execução concluída sem output.",
        imagePath: generatedImage,
      };
    } catch (e: any) {
      logger.error("Erro ao executar Python", { error: e.message });
      let errStr = e.message;
      if (e.killed)
        errStr = "Timeout: a execução excedeu o limite de 10 segundos.";
      else if (e.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER")
        errStr = "Limite de memória/output excedido.";

      return {
        success: false,
        data: "",
        error: `Falha na execução Python: ${errStr}`,
      };
    } finally {
      // Como o Telegram pode precisar ler a imagem APÓS essa função retornar,
      // é melhor você lidar com o rmSync(workDir) no orquestrador do bot
      // DEPOIS que ele enviar o `bot.sendPhoto`.
      // Se não gerar imagem, pode limpar agora:
      if (!existsSync(expectedImagePath)) {
        try {
          rmSync(workDir, { recursive: true, force: true });
        } catch (e) {}
      }
    }
  },
};
