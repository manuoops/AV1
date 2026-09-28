import * as fs from "fs";

export function carregarHistorico(caminho: string, limite: number): string[] {
  try {
    if (!fs.existsSync(caminho)) {
      return [];
    }
    const conteudo = fs.readFileSync(caminho, "utf8");
    const linhasCronologicas = conteudo
      .split("\n")
      .map((linha) => linha.trim())
      .filter((linha) => linha.length > 0);

    return linhasCronologicas.slice(-limite).reverse();
  } catch {
    // histórico corrompido e/ou ilegível não deve interromper o sistema de iniciar
    return [];
  }
}


export function salvarHistorico(caminho: string, historicoMaisRecentePrimeiro: string[], limite: number): void {
  try {
    const cronologico = [...historicoMaisRecentePrimeiro].reverse();
    const recentes = cronologico.slice(-limite);
    fs.writeFileSync(caminho, recentes.join("\n"), "utf8");
  } catch {
    // falhas no salvamento do historico não devem derrubar a aplicação
  }
}