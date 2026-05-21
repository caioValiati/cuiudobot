import { config } from "../config.js";

/**
 * Verifica se um usuário do Telegram está na whitelist
 */
export function isAllowedUser(userId: number): boolean {
  return config.telegramAllowedUserIds.includes(userId);
}

/**
 * Sanitiza o input do usuário básico
 */
export function sanitizeInput(text: string): string {
  if (!text) return "";
  // Remover caracteres nulos
  let cleanText = text.replace(/\0/g, "");
  // Limita tamanho para evitar abusos no banco (ex: 20k chars)
  if (cleanText.length > 20000) {
    cleanText = cleanText.substring(0, 20000);
  }
  return cleanText;
}

/**
 * Regex para detectar imports potencialmente perigosos em Python
 */
export const DANGEROUS_PYTHON_IMPORTS = [
  "os",
  "subprocess",
  "shutil",
  "socket",
  "urllib",
  "http",
  "requests",
  "sys",
  "ctypes",
  "pty",
  "builtins",
];

export function hasDangerousPythonImports(code: string): boolean {
  const importPattern = /^\s*(import|from)\s+([a-zA-Z0-9_, ]+)/gm;
  let match;
  while ((match = importPattern.exec(code)) !== null) {
    const importedModules = match[2]
      .split(",")
      .map((m) => m.trim().split(" ")[0]);
    for (const mod of importedModules) {
      if (DANGEROUS_PYTHON_IMPORTS.includes(mod)) {
        return true;
      }
    }
  }

  // Verifica tentativas de usar __import__ ou importlib
  if (code.includes("__import__") || code.includes("importlib")) {
    return true;
  }

  return false;
}

/**
 * Heurística básica de detecção de Prompt Injection
 */
export function detectPromptInjection(text: string): boolean {
  if (!text) return false;

  const lowerText = text.toLowerCase();

  const injectionPatterns = [
    "ignore previous",
    "ignore all previous",
    "ignore everything before",
    "system prompt",
    "new instructions:",
    "forget all instructions",
    "disregard previous",
    "you are now",
    "simule ser",
    "ignore as instruções anteriores",
    "esqueça o que eu disse antes",
    "esqueça suas regras",
  ];

  for (const pattern of injectionPatterns) {
    if (lowerText.includes(pattern)) {
      return true;
    }
  }

  return false;
}
