import { interpretarComando, ComandoInterpretado } from "./ComandoParser";
import { PapelUsuario } from "../domain/enums/PapelUsuario";
import { Sessao } from "../domain/entities/Sessao";

export enum Severidade {
  SUCESSO = "SUCESSO",
  ERRO = "ERRO",
  AVISO = "AVISO",
  INFO = "INFO"
}

export interface ResultadoComando {
  severidade: Severidade;
  mensagem: string;
  novaSessao?: Sessao | null;
}

export interface ContextoExecucao {
  flags: Record<string, string>;
  sessao: Sessao | null;
}

export interface ComandoDefinido {
  recurso: string;
  acao: string;
  requerAutenticacao: boolean;
  papeisPermitidos: PapelUsuario[];
  descricao: string;
  executar: (contexto: ContextoExecucao) => ResultadoComando;
}

export class Despachante {
  private readonly comandos = new Map<string, ComandoDefinido>();

  public registrar(comando: ComandoDefinido): void {
    const chave = this.chave(comando.recurso, comando.acao);
    if (this.comandos.has(chave)) {
      throw new Error(`Comando '${comando.recurso} ${comando.acao}' já está registrado.`);
    }
    this.comandos.set(chave, comando);
  }

  public despachar(linha: string, sessaoAtual: Sessao | null): ResultadoComando {
    let interpretado: ComandoInterpretado;
    try {
      interpretado = interpretarComando(linha);
    } catch (erro) {
      return { severidade: Severidade.ERRO, mensagem: (erro as Error).message };
    }

    const comando = this.comandos.get(this.chave(interpretado.recurso, interpretado.acao));
    if (!comando) {
      return {
        severidade: Severidade.ERRO,
        mensagem: `Comando não reconhecido: '${interpretado.recurso} ${interpretado.acao}'. Digite 'ajuda' para ver os comandos disponíveis.`
      };
    }

    if (comando.requerAutenticacao) {
      if (!sessaoAtual) {
        return { severidade: Severidade.ERRO, mensagem: "Você precisa fazer login antes de executar este comando." };
      }
      const papelPermitido =
        comando.papeisPermitidos.length === 0 || comando.papeisPermitidos.includes(sessaoAtual.papel);
      if (!papelPermitido) {
        return {
          severidade: Severidade.ERRO,
          mensagem: `Seu papel (${sessaoAtual.papel}) não tem permissão para executar este comando.`
        };
      }
    }

    try {
      return comando.executar({ flags: interpretado.flags, sessao: sessaoAtual });
    } catch (erro) {
      return { severidade: Severidade.ERRO, mensagem: (erro as Error).message };
    }
  }

  public listarComandosDisponiveis(papelAtual: PapelUsuario | null): ComandoDefinido[] {
    return [...this.comandos.values()].filter((comando) => {
      if (!comando.requerAutenticacao) {
        return true;
      }
      if (!papelAtual) {
        return false;
      }
      return comando.papeisPermitidos.length === 0 || comando.papeisPermitidos.includes(papelAtual);
    });
  }

  private chave(recurso: string, acao: string): string {
    return `${recurso}:${acao}`;
  }
}