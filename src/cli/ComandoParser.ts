export interface ComandoInterpretado {
  recurso: string;
  acao: string;
  flags: Record<string, string>;
}

function tokenizar(linha: string): string[] {
  const tokens: string[] = [];
  let tokenAtual = "";
  let dentroDeAspas: '"' | "'" | null = null;

  for (const caractere of linha) {
    if (dentroDeAspas) {
      if (caractere === dentroDeAspas) {
        dentroDeAspas = null;
      } else {
        tokenAtual += caractere;
      }
      continue;
    }

    if (caractere === '"' || caractere === "'") {
      dentroDeAspas = caractere;
      continue;
    }

    if (/\s/.test(caractere)) {
      if (tokenAtual.length > 0) {
        tokens.push(tokenAtual);
        tokenAtual = "";
      }
      continue;
    }

    tokenAtual += caractere;
  }

  if (dentroDeAspas) {
    throw new Error("Comando inválido: aspas não foram fechadas.");
  }
  if (tokenAtual.length > 0) {
    tokens.push(tokenAtual);
  }

  return tokens;
}

export function interpretarComando(linha: string): ComandoInterpretado {
  const tokens = tokenizar(linha.trim());

  if (tokens.length === 0) {
    throw new Error("Comando vazio.");
  }
  if (tokens.length < 2) {
    throw new Error("Comando incompleto: informe <recurso> <ação>. Ex: lote criar --org BR001");
  }

  const recurso = (tokens[0] as string).toLowerCase();
  const acao = (tokens[1] as string).toLowerCase();
  const flags: Record<string, string> = {};

  let indice = 2;
  while (indice < tokens.length) {
    const token = tokens[indice] as string;

    if (!token.startsWith("--")) {
      throw new Error(`Argumento inesperado: '${token}'. Argumentos devem começar com --, ex: --org BR001`);
    }

    const nomeFlag = token.slice(2);
    if (nomeFlag.length === 0) {
      throw new Error("Nome de flag vazio após '--'.");
    }

    const proximoToken = tokens[indice + 1];
    const proximoEhOutraFlag = proximoToken === undefined || proximoToken.startsWith("--");

    if (proximoEhOutraFlag) {
      flags[nomeFlag] = "true";
      indice += 1;
    } else {
      flags[nomeFlag] = proximoToken as string;
      indice += 2;
    }
  }

  return { recurso, acao, flags };
}