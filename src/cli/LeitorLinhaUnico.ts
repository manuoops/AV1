import * as readline from "readline";

export class LeitorLinhaUnico {
  public readonly rl: readline.Interface;
  private readonly filaPerguntasPendentes: Array<(resposta: string) => void> = [];
  private callbackComando: ((linha: string) => void) | null = null;

  private readonly linhasNaoEntregues: string[] = [];

  constructor(rl: readline.Interface) {
    this.rl = rl;
    this.rl.on("line", (linha) => this.rotear(linha));
  }

  public perguntar(pergunta: string): Promise<string> {
    process.stdout.write(pergunta);

    if (this.linhasNaoEntregues.length > 0) {
      const linha = this.linhasNaoEntregues.shift() as string;
      return Promise.resolve(linha);
    }

    return new Promise((resolve) => {
      this.filaPerguntasPendentes.push(resolve);
    });
  }

  public definirCallbackComando(callback: (linha: string) => void): void {
    this.callbackComando = callback;

    while (this.linhasNaoEntregues.length > 0) {
      const linha = this.linhasNaoEntregues.shift() as string;
      this.callbackComando(linha);
    }
  }

  private rotear(linha: string): void {
    const proximaPergunta = this.filaPerguntasPendentes.shift();
    if (proximaPergunta) {
      proximaPergunta(linha);
      return;
    }
    if (this.callbackComando) {
      this.callbackComando(linha);
      return;
    }
    this.linhasNaoEntregues.push(linha);
  }
}