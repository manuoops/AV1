import * as crypto from "crypto";

export class CriptografiaArquivo {
  private static readonly ALGORITMO = "aes-256-gcm";
  private static readonly TAMANHO_IV_BYTES = 12;
  private static readonly TAMANHO_CHAVE_BYTES = 32;


  public cifrar(dados: string, chave: string): string {
    const chaveBuffer = this.converterChaveParaBuffer(chave);
    const iv = crypto.randomBytes(CriptografiaArquivo.TAMANHO_IV_BYTES);

    const cifrador = crypto.createCipheriv(
      CriptografiaArquivo.ALGORITMO,
      chaveBuffer,
      iv
    );

    const cifradoParcial = cifrador.update(dados, "utf8");
    const cifradoFinal = Buffer.concat([cifradoParcial, cifrador.final()]);
    const authTag = cifrador.getAuthTag();

    return [
      iv.toString("hex"),
      authTag.toString("hex"),
      cifradoFinal.toString("hex")
    ].join(":");
  }

  public decifrar(dadosCifrados: string, chave: string): string {
    const chaveBuffer = this.converterChaveParaBuffer(chave);
    const partes = dadosCifrados.split(":");

    if (partes.length !== 3) {
      throw new Error(
        "Formato de dado cifrado inválido: esperado 'iv:authTag:conteudo'."
      );
    }

    const [ivHex, authTagHex, conteudoHex] = partes;
    const iv = Buffer.from(ivHex!, "hex");
    const authTag = Buffer.from(authTagHex!, "hex");
    const conteudoCifrado = Buffer.from(conteudoHex!, "hex");

    const decifrador = crypto.createDecipheriv(
      CriptografiaArquivo.ALGORITMO,
      chaveBuffer,
      iv
    );
    decifrador.setAuthTag(authTag);

    const decifradoParcial = decifrador.update(conteudoCifrado);
    const decifradoFinal = Buffer.concat([
      decifradoParcial,
      decifrador.final()
    ]);

    return decifradoFinal.toString("utf8");
  }

  public gerarChave(): string {
    return crypto
      .randomBytes(CriptografiaArquivo.TAMANHO_CHAVE_BYTES)
      .toString("hex");
  }

  private converterChaveParaBuffer(chave: string): Buffer {
    const buffer = Buffer.from(chave, "hex");
    if (buffer.length !== CriptografiaArquivo.TAMANHO_CHAVE_BYTES) {
      throw new Error(
        `Chave inválida: esperado ${CriptografiaArquivo.TAMANHO_CHAVE_BYTES} bytes (256 bits) em hex, recebido ${buffer.length} bytes.`
      );
    }
    return buffer;
  }
}