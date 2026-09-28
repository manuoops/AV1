import * as crypto from "crypto";
import { Contrato } from "./Contrato";

export interface OrganizacaoPersistida {
  id: string;
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual: string;
  enderecoCompleto: string;
  telefone: string;
  email: string;
  dataCadastro: string | Date;
  ativo: boolean;
}

export class Organizacao {
  public readonly id: string;
  public razaoSocial: string;
  public readonly cnpj: string;
  public inscricaoEstadual: string;
  public enderecoCompleto: string;
  public telefone: string;
  public email: string;
  public readonly dataCadastro: Date;
  public ativo: boolean;

  public contratoVigente: Contrato | null = null;

  constructor(dados: OrganizacaoPersistida) {
    this.id = dados.id;
    this.razaoSocial = dados.razaoSocial;
    this.cnpj = dados.cnpj;
    this.inscricaoEstadual = dados.inscricaoEstadual;
    this.enderecoCompleto = dados.enderecoCompleto;
    this.telefone = dados.telefone;
    this.email = dados.email;
    this.dataCadastro = new Date(dados.dataCadastro);
    this.ativo = dados.ativo;
  }

  public static criar(dados: {
    razaoSocial: string;
    cnpj: string;
    inscricaoEstadual: string;
    enderecoCompleto: string;
    telefone: string;
    email: string;
  }): Organizacao {
    for (const [campo, valor] of Object.entries(dados)) {
      if (!Organizacao.ehTextoValido(valor)) {
        throw new Error(`Campo obrigatório em branco: ${campo}.`);
      }
    }

    return new Organizacao({
      id: crypto.randomUUID(),
      ...dados,
      dataCadastro: new Date(),
      ativo: true
    });
  }

  public alterarEndereco(novoEndereco: string): void {
    if (!Organizacao.ehTextoValido(novoEndereco)) {
      throw new Error("Novo endereço não pode ser vazio.");
    }
    this.enderecoCompleto = novoEndereco;
  }

  public desativar(): void {
    this.ativo = false;
  }

  public reativar(): void {
    this.ativo = true;
  }

  private static ehTextoValido(texto: unknown): boolean {
    return typeof texto === "string" && texto.trim().length > 0;
  }
}