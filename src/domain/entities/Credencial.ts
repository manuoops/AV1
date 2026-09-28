import * as crypto from "crypto";
import { PapelUsuario } from "../enums/PapelUsuario";

export interface CredencialPersistida {
  id: string;
  usuario: string;
  hashSenha: string;
  salt: string;
  ultimoAcesso: string | Date;
  papel: PapelUsuario;
}

export class Credencial {
  public readonly id: string;
  public readonly usuario: string;
  public hashSenha: string;
  public readonly salt: string;
  public ultimoAcesso: Date;
  public papel: PapelUsuario;

  constructor(dados: CredencialPersistida) {
    this.id = dados.usuario;
    this.usuario = dados.usuario;
    this.hashSenha = dados.hashSenha;
    this.salt = dados.salt;
    this.ultimoAcesso = new Date(dados.ultimoAcesso);
    this.papel = dados.papel;
  }

  public static criar(usuario: string, senhaPlana: string, papel: PapelUsuario): Credencial {
    if (!Credencial.ehTextoValido(usuario)) {
      throw new Error("Nome de usuário não pode ser vazio.");
    }
    if (!Credencial.ehTextoValido(senhaPlana)) {
      throw new Error("Senha não pode ser vazia.");
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const hashSenha = Credencial.calcularHash(senhaPlana, salt);

    return new Credencial({
      id: usuario,
      usuario,
      hashSenha,
      salt,
      ultimoAcesso: new Date(),
      papel
    });
  }

  public verificarSenha(senhaPlana: string): boolean {
    if (!Credencial.ehTextoValido(senhaPlana)) {
      return false;
    }

    const hashCalculado = Credencial.calcularHash(senhaPlana, this.salt);
    const bufferArmazenado = Buffer.from(this.hashSenha, "hex");
    const bufferCalculado = Buffer.from(hashCalculado, "hex");

    if (bufferArmazenado.length !== bufferCalculado.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufferArmazenado, bufferCalculado);
  }

  public atualizarUltimoAcesso(): void {
    this.ultimoAcesso = new Date();
  }

  public redefinirSenha(novaSenhaPlana: string): void {
    if (!Credencial.ehTextoValido(novaSenhaPlana)) {
      throw new Error("Nova senha não pode ser vazia.");
    }
    this.hashSenha = Credencial.calcularHash(novaSenhaPlana, this.salt);
  }

  private static ehTextoValido(texto: string | null | undefined): boolean {
    return typeof texto === "string" && texto.trim().length > 0;
  }

  private static calcularHash(senhaPlana: string, salt: string): string {
    return crypto
      .createHash("sha256")
      .update(salt + senhaPlana)
      .digest("hex");
  }
}