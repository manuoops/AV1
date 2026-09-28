import * as crypto from "crypto";
import { PapelUsuario } from "../enums/PapelUsuario";

const DURACAO_INATIVIDADE_MINUTOS = 30;

export interface SessaoPersistida {
  id: string;
  token: string;
  usuario: string;
  papel: PapelUsuario;
  criacao: string | Date;
  expiracao: string | Date;
}

export class Sessao {
  public readonly id: string;
  public readonly token: string;
  public readonly usuario: string;
  public readonly papel: PapelUsuario;
  public readonly criacao: Date;
  public expiracao: Date;

  constructor(dados: SessaoPersistida) {
    this.id = dados.id;
    this.token = dados.token;
    this.usuario = dados.usuario;
    this.papel = dados.papel;
    this.criacao = new Date(dados.criacao);
    this.expiracao = new Date(dados.expiracao);
  }

  public static criar(usuario: string, papel: PapelUsuario): Sessao {
    const token = crypto.randomBytes(32).toString("hex");
    const agora = new Date();

    return new Sessao({
      id: token,
      token,
      usuario,
      papel,
      criacao: agora,
      expiracao: Sessao.calcularNovaExpiracao(agora)
    });
  }

  public isValida(): boolean {
    return new Date().getTime() < this.expiracao.getTime();
  }

  public renovar(): void {
    this.expiracao = Sessao.calcularNovaExpiracao(new Date());
  }

  private static calcularNovaExpiracao(referencia: Date): Date {
    return new Date(referencia.getTime() + DURACAO_INATIVIDADE_MINUTOS * 60 * 1000);
  }
}