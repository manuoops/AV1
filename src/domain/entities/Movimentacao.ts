import * as crypto from "crypto";

export interface MovimentacaoPersistida {
  id: string;
  equipamentoId: string;
  dataHora: string | Date;
  origem: string;
  destino: string;
  responsavel: string;
  observacao: string;
}

export class Movimentacao {
  public readonly id: string;
  public readonly equipamentoId: string;
  public readonly dataHora: Date;
  public readonly origem: string;
  public readonly destino: string;
  public readonly responsavel: string;
  public readonly observacao: string;

  constructor(dados: MovimentacaoPersistida) {
    this.id = dados.id;
    this.equipamentoId = dados.equipamentoId;
    this.dataHora = new Date(dados.dataHora);
    this.origem = dados.origem;
    this.destino = dados.destino;
    this.responsavel = dados.responsavel;
    this.observacao = dados.observacao;
  }

  public static criar(dados: {
    equipamentoId: string;
    origem: string;
    destino: string;
    responsavel: string;
    observacao?: string;
  }): Movimentacao {
    if (!dados.destino || dados.destino.trim().length === 0) {
      throw new Error("destino é obrigatório.");
    }
    if (!dados.responsavel || dados.responsavel.trim().length === 0) {
      throw new Error("responsavel é obrigatório.");
    }

    return new Movimentacao({
      id: crypto.randomUUID(),
      equipamentoId: dados.equipamentoId,
      dataHora: new Date(),
      origem: dados.origem,
      destino: dados.destino,
      responsavel: dados.responsavel,
      observacao: dados.observacao ?? ""
    });
  }
}