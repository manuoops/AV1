import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { RepositorioArquivo } from "./RepositorioArquivo";

const NOME_ARQUIVO_JOURNAL = "journal.json";
const TAMANHO_MAX_BYTES = 10 * 1024 * 1024; 
const DIAS_RETENCAO_MINIMA = 180; 

export class JournalTransacao {
  private static repositorio: RepositorioArquivo | null = null;
  private static diretorioBase: string | null = null;

  public readonly id: string;
  public readonly timestamp: Date;
  public readonly operacao: string;
  public readonly entidade: string;
  public readonly dadosAntes: unknown;
  public readonly dadosDepois: unknown;
  public readonly dataCadastro: Date;
  public readonly usuarioResponsavel: string;
  public ativo: boolean;

  constructor(params: {
    operacao: string;
    entidade: string;
    dadosAntes: unknown;
    dadosDepois: unknown;
    usuarioResponsavel: string;
  }) {
    this.id = crypto.randomUUID();
    this.timestamp = new Date();
    this.dataCadastro = new Date();
    this.operacao = params.operacao;
    this.entidade = params.entidade;
    this.dadosAntes = params.dadosAntes;
    this.dadosDepois = params.dadosDepois;
    this.usuarioResponsavel = params.usuarioResponsavel;
    this.ativo = true;
  }

  public static configurar(repositorio: RepositorioArquivo, diretorioBase: string): void {
    JournalTransacao.repositorio = repositorio;
    JournalTransacao.diretorioBase = diretorioBase;
  }

  public registrar(): void {
    const repositorio = this.obterRepositorioConfigurado();
    repositorio.salvarEntidade(NOME_ARQUIVO_JOURNAL, this);
    this.verificarRotacao();
  }

  public reverter(): boolean {
    if (!this.ativo) {
      return false;
    }

    this.ativo = false;
    const repositorio = this.obterRepositorioConfigurado();
    repositorio.salvarEntidade(NOME_ARQUIVO_JOURNAL, this);
    return true;
  }

  public static purgarRegistrosAntigos(diasRetencao: number = DIAS_RETENCAO_MINIMA): number {
    if (diasRetencao < DIAS_RETENCAO_MINIMA) {
      throw new Error(
        `Retenção mínima exigida é de ${DIAS_RETENCAO_MINIMA} dias.`
      );
    }

    const repositorio = JournalTransacao.obterRepositorioEstatico();
    const registros = repositorio.listarEntidades<JournalTransacao>(NOME_ARQUIVO_JOURNAL);
    const limiteMs = Date.now() - diasRetencao * 24 * 60 * 60 * 1000;

    const registrosMantidos = registros.filter((r) => new Date(r.dataCadastro).getTime() >= limiteMs);
    const quantidadeRemovida = registros.length - registrosMantidos.length;

    if (quantidadeRemovida > 0) {
      for (const registro of registros) {
        if (new Date(registro.dataCadastro).getTime() < limiteMs) {
          repositorio.excluirEntidade(NOME_ARQUIVO_JOURNAL, registro.id);
        }
      }
    }

    return quantidadeRemovida;
  }

  private obterRepositorioConfigurado(): RepositorioArquivo {
    return JournalTransacao.obterRepositorioEstatico();
  }

  private static obterRepositorioEstatico(): RepositorioArquivo {
    if (!JournalTransacao.repositorio) {
      throw new Error(
        "JournalTransacao não foi configurado. Chame JournalTransacao.configurar(repositorio, diretorioBase) na inicialização do sistema."
      );
    }
    return JournalTransacao.repositorio;
  }

  private verificarRotacao(): void {
    if (!JournalTransacao.diretorioBase) {
      return;
    }

    const caminhoJournal = path.join(JournalTransacao.diretorioBase, NOME_ARQUIVO_JOURNAL);

    if (!fs.existsSync(caminhoJournal)) {
      return;
    }

    const tamanho = fs.statSync(caminhoJournal).size;
    if (tamanho <= TAMANHO_MAX_BYTES) {
      return;
    }

    const sufixo = new Date().toISOString().replace(/[:.]/g, "-");
    const caminhoArquivado = path.join(
      JournalTransacao.diretorioBase,
      `journal.${sufixo}.archive.json`
    );
    fs.renameSync(caminhoJournal, caminhoArquivado);
  }
}