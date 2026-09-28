import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { CriptografiaArquivo } from "./CriptografiaArquivo";

interface EntidadeComId {
  id: string;
}

export class RepositorioArquivo {
  private readonly diretorioBase: string;
  private readonly criptografia: CriptografiaArquivo;
  private readonly chave: string;

  constructor(diretorioBase: string, criptografia: CriptografiaArquivo, chave: string) {
    this.diretorioBase = diretorioBase;
    this.criptografia = criptografia;
    this.chave = chave;
    this.garantirDiretorioBase();
  }

  public salvarEntidade<T extends EntidadeComId>(nomeArquivo: string, entidade: T): void {
    const registros = this.lerTodas<T>(nomeArquivo);
    const indiceExistente = registros.findIndex((r) => r.id === entidade.id);

    if (indiceExistente >= 0) {
      registros[indiceExistente] = entidade;
    } else {
      registros.push(entidade);
    }

    this.escreverTodas(nomeArquivo, registros);
  }

  public carregarEntidade<T extends EntidadeComId>(nomeArquivo: string, id: string): T | null {
    const registros = this.lerTodas<T>(nomeArquivo);
    const encontrado = registros.find((r) => r.id === id);
    return encontrado ?? null;
  }

  public listarEntidades<T extends EntidadeComId>(nomeArquivo: string): T[] {
    return this.lerTodas<T>(nomeArquivo);
  }

  public excluirEntidade(nomeArquivo: string, id: string): void {
    const registros = this.lerTodas<EntidadeComId>(nomeArquivo);
    const registrosRestantes = registros.filter((r) => r.id !== id);
    this.escreverTodas(nomeArquivo, registrosRestantes);
  }

  private caminhoCompleto(nomeArquivo: string): string {
    return path.join(this.diretorioBase, nomeArquivo);
  }

  private garantirDiretorioBase(): void {
    fs.mkdirSync(this.diretorioBase, { recursive: true });
  }

  private lerTodas<T>(nomeArquivo: string): T[] {
    const caminho = this.caminhoCompleto(nomeArquivo);

    if (!fs.existsSync(caminho)) {
      return [];
    }

    const conteudoCifrado = fs.readFileSync(caminho, "utf8").trim();

    if (conteudoCifrado.length === 0) {
      return [];
    }

    const conteudoDecifrado = this.criptografia.decifrar(conteudoCifrado, this.chave);
    return JSON.parse(conteudoDecifrado) as T[];
  }

  private escreverTodas<T>(nomeArquivo: string, registros: T[]): void {
    const caminhoFinal = this.caminhoCompleto(nomeArquivo);
    const sufixoAleatorio = crypto.randomBytes(6).toString("hex");
    const caminhoTemporario = `${caminhoFinal}.${sufixoAleatorio}.tmp`;

    const conteudoJson = JSON.stringify(registros, null, 2);
    const conteudoCifrado = this.criptografia.cifrar(conteudoJson, this.chave);

    fs.writeFileSync(caminhoTemporario, conteudoCifrado, "utf8");
    fs.renameSync(caminhoTemporario, caminhoFinal);
  }
}