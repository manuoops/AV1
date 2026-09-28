import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as path from "path";

const RAIZ_PROJETO = path.join(__dirname, "..", "..");

const PADRAO_PROMPT = />\s*$/;

interface Espera {
  padrao: RegExp;
  resolve: (saidaCapturada: string) => void;
  timeout: NodeJS.Timeout;
}

export class ClienteCLI {
  private readonly processo: ChildProcessWithoutNullStreams;
  private readonly timeoutMsPadrao: number;
  private buffer = "";
  private aguardando: Espera | null = null;
  private readonly logsBrutos: string[] = [];

  constructor(diretorioDados: string, timeoutMsPadrao = 10_000) {
    this.timeoutMsPadrao = timeoutMsPadrao;

    this.processo = spawn("npx", ["ts-node", "src/cli/main.ts"], {
      shell: true,
      cwd: RAIZ_PROJETO,
      env: { ...process.env, GREENCODE_DATA_DIR: diretorioDados },
      stdio: ["pipe", "pipe", "pipe"]
    });

    this.processo.stdout.on("data", (chunk: Buffer) => this.tratarSaida(chunk.toString("utf8")));
    this.processo.stderr.on("data", (chunk: Buffer) => {
      const texto = chunk.toString("utf8");
      this.logsBrutos.push(`[stderr] ${texto}`);
      console.error("[greencode stderr]", texto);
    });

    this.processo.on("exit", (codigo) => {
      this.logsBrutos.push(`[processo encerrado, código ${codigo}]`);
    });
  }

  private tratarSaida(pedaco: string): void {
    this.buffer += pedaco;
    this.logsBrutos.push(pedaco);

    if (this.aguardando && this.aguardando.padrao.test(this.buffer)) {
      const { resolve, timeout } = this.aguardando;
      clearTimeout(timeout);
      const saidaCapturada = this.buffer;
      this.buffer = "";
      this.aguardando = null;
      resolve(saidaCapturada);
    }
  }

  public aguardar(padrao: RegExp, timeoutMs = this.timeoutMsPadrao): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.aguardando = null;
        reject(
          new Error(
            `Timeout (${timeoutMs}ms) esperando o padrão ${padrao}. ` +
              `Saída acumulada até agora:\n${this.buffer || "(vazia)"}`
          )
        );
      }, timeoutMs);

      this.aguardando = { padrao, resolve, timeout };
    });
  }

  public escrever(linha: string): void {
    this.processo.stdin.write(`${linha}\n`);
  }

  public async comando(linha: string, timeoutMs = this.timeoutMsPadrao): Promise<string> {
    const promessaSaida = this.aguardar(PADRAO_PROMPT, timeoutMs);
    this.escrever(linha);
    return promessaSaida;
  }

  public encerrar(): void {
    this.processo.stdin.end();
    this.processo.kill();
  }

  public obterLogCompleto(): string {
    return this.logsBrutos.join("");
  }
}

export function extrairGrupo(texto: string, regex: RegExp, descricao: string): string {
  const resultado = texto.match(regex);
  if (!resultado || resultado[1] === undefined) {
    throw new Error(`Não foi possível extrair '${descricao}' da saída:\n${texto}`);
  }
  return resultado[1];
}