import * as crypto from "crypto";

export interface ContratoPersistido {
  id: string;
  organizacaoId: string;
  dataAssinatura: string | Date;
  dataVencimento: string | Date;
  clausulas: string[];
  valorMensal: number;
  renovacaoAutomatica: boolean;
}

export class Contrato {
  public readonly id: string;
  public readonly organizacaoId: string;
  public readonly dataAssinatura: Date;
  public dataVencimento: Date;
  public clausulas: string[];
  public valorMensal: number;
  public renovacaoAutomatica: boolean;

  constructor(dados: ContratoPersistido) {
    this.id = dados.id;
    this.organizacaoId = dados.organizacaoId;
    this.dataAssinatura = new Date(dados.dataAssinatura);
    this.dataVencimento = new Date(dados.dataVencimento);
    this.clausulas = dados.clausulas;
    this.valorMensal = dados.valorMensal;
    this.renovacaoAutomatica = dados.renovacaoAutomatica;
  }

  public static criar(dados: {
    organizacaoId: string;
    dataVencimento: Date;
    clausulas: string[];
    valorMensal: number;
    renovacaoAutomatica: boolean;
  }): Contrato {
    if (!dados.organizacaoId || dados.organizacaoId.trim().length === 0) {
      throw new Error("organizacaoId é obrigatório.");
    }
    if (!(dados.valorMensal > 0)) {
      throw new Error("valorMensal deve ser um número positivo.");
    }

    const agora = new Date();
    if (dados.dataVencimento.getTime() <= agora.getTime()) {
      throw new Error("dataVencimento deve ser uma data futura.");
    }

    return new Contrato({
      id: crypto.randomUUID(),
      organizacaoId: dados.organizacaoId,
      dataAssinatura: agora,
      dataVencimento: dados.dataVencimento,
      clausulas: dados.clausulas,
      valorMensal: dados.valorMensal,
      renovacaoAutomatica: dados.renovacaoAutomatica
    });
  }

  public estaVigente(): boolean {
    return new Date().getTime() <= this.dataVencimento.getTime();
  }

  public renovar(novoVencimento: Date): void {
    if (novoVencimento.getTime() <= this.dataVencimento.getTime()) {
      throw new Error("Novo vencimento deve ser posterior ao vencimento atual.");
    }
    this.dataVencimento = novoVencimento;
  }
}