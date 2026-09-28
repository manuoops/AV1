import * as readline from "readline";
import * as path from "path";
import { Despachante, Severidade } from "./Despachante";
import { LeitorLinhaUnico } from "./LeitorLinhaUnico";
import { registrarComandosUsuario } from "./comandos/ComandosUsuario";
import { registrarComandosOrganizacao } from "./comandos/ComandosOrganizacao";
import { registrarComandosLote } from "./comandos/ComandosLote";
import { registrarComandosEquipamento } from "./comandos/ComandosEquipamento";
import { registrarComandosRelatorio } from "./comandos/ComandosRelatorio";
import { salvarHistorico } from "./HistoricoComandos";
import { ServicoAutenticacao } from "../services/ServicoAutenticacao";
import { ServicoOrganizacao } from "../services/ServicoOrganizacao";
import { ServicoLote } from "../services/ServicoLote";
import { ServicoEquipamento } from "../services/ServicoEquipamento";
import { ServicoRelatorio } from "../services/ServicoRelatorio";
import { Sessao } from "../domain/entities/Sessao";
import { PapelUsuario } from "../domain/enums/PapelUsuario";

const NOME_ARQUIVO_HISTORICO = ".greencode_history";
const TAMANHO_MAX_HISTORICO = 200;

export interface ServicosCLI {
  autenticacao: ServicoAutenticacao;
  organizacao: ServicoOrganizacao;
  lote: ServicoLote;
  equipamento: ServicoEquipamento;
  relatorio: ServicoRelatorio;
}

export class CLIInterface {
  private readonly autenticacao: ServicoAutenticacao;
  private readonly despachante: Despachante;
  private readonly caminhoHistorico: string;
  private rl: readline.Interface | null = null;

  public sessaoAtual: Sessao | null = null;
  private encerrando: boolean = false;

  constructor(servicos: ServicosCLI, diretorioBase: string) {
    this.autenticacao = servicos.autenticacao;

    this.despachante = new Despachante();
    registrarComandosUsuario(this.despachante, servicos.autenticacao);
    registrarComandosOrganizacao(this.despachante, servicos.organizacao);
    registrarComandosLote(this.despachante, servicos.lote);
    registrarComandosEquipamento(this.despachante, servicos.equipamento);
    registrarComandosRelatorio(this.despachante, servicos.relatorio);

    this.caminhoHistorico = path.join(diretorioBase, NOME_ARQUIVO_HISTORICO);
  }

  public iniciarLoop(leitor: LeitorLinhaUnico): void {
    this.rl = leitor.rl;

    console.log("\ngreencode - sistema de gestão de logística reversa de equipamentos eletrônicos");
    console.log("Digite 'ajuda' para ver os comandos disponíveis, ou 'sair' para encerrar.\n");

    this.rl.setPrompt(this.montarPrompt());
    this.rl.prompt();

    // IMPORTANTE — ORDEM CRÍTICA: este listener de 'close' precisa ser
    // registrado ANTES de leitor.definirCallbackComando() logo abaixo.
    //
    // definirCallbackComando() pode entregar, de forma SÍNCRONA, linhas que
    // já haviam chegado via pipe e ficaram na fila `linhasNaoEntregues` do
    // LeitorLinhaUnico (isso inclui, por exemplo, um 'sair' já digitado
    // antes mesmo da CLIInterface existir). Se isso acontecer, o
    // processarComando('sair') chama this.rl.close() ainda DENTRO dessa
    // entrega síncrona — e o readline.Interface emite o evento 'close' de
    // forma síncrona, direto dentro do método close(). Se o listener abaixo
    // só fosse registrado depois de definirCallbackComando(), o evento
    // 'close' passaria sem ninguém ouvindo, e a mensagem "Até logo!" (e o
    // salvamento do histórico) nunca rodariam. Foi exatamente esse o bug:
    // sumia mesmo sem process.exit() forçado, porque o handler nunca era
    // sequer alcançado.
    this.rl.on("close", () => {
      this.persistirHistorico();
      console.log("\nAté logo!");
      // Não chamamos process.exit() aqui de propósito: process.exit()
      // logo depois de um console.log() pode CORTAR a escrita do stdout
      // antes dela terminar quando a saída está sendo redirecionada (pipe)
      // — o Node bufferiza escrita em pipe de forma assíncrona (diferente
      // de quando stdout é um terminal de verdade). Sem handles abertos
      // (o readline já fechou), o processo encerra sozinho naturalmente
      // assim que o event loop esvaziar, o que já dá tempo do stdout
      // esvaziar o buffer primeiro.
      process.exitCode = 0;
    });

    leitor.definirCallbackComando((entrada) => {
      this.processarComando(entrada);
      if (this.encerrando) {
        return;
      }
      this.persistirHistorico();
      if (this.rl) {
        this.rl.setPrompt(this.montarPrompt());
        this.rl.prompt();
      }
    });
  }

  public obterCompleter(): (linha: string) => [string[], string] {
    return (linha: string) => this.completar(linha);
  }

  public processarComando(entrada: string): void {
    const linha = entrada.trim();
    if (linha.length === 0) {
      return;
    }

    const linhaMinuscula = linha.toLowerCase();
    if (linhaMinuscula === "ajuda" || linhaMinuscula === "help") {
      this.exibirMenuPorPapel(this.sessaoAtual ? this.sessaoAtual.papel : null);
      return;
    }
    if (linhaMinuscula === "sair" || linhaMinuscula === "exit") {
      this.encerrando = true;
      this.rl?.close();
      return;
    }

    if (this.sessaoAtual) {
      const aindaValida = this.autenticacao.validarToken(this.sessaoAtual.token);
      if (!aindaValida) {
        console.log(this.formatar(Severidade.AVISO, "Sua sessão expirou por inatividade. Faça login novamente."));
        this.sessaoAtual = null;
      }
    }

    const resultado = this.despachante.despachar(linha, this.sessaoAtual);
    console.log(this.formatar(resultado.severidade, resultado.mensagem));

    if (resultado.novaSessao !== undefined) {
      this.sessaoAtual = resultado.novaSessao;
    }
  }

  public exibirMenuPorPapel(papel: PapelUsuario | null): void {
    const comandos = this.despachante.listarComandosDisponiveis(papel);
    console.log("\n=== Comandos disponíveis ===");

    if (comandos.length === 0) {
      console.log("  (nenhum comando disponível — faça login com: usuario login --usuario <nome> --senha <senha>)");
    }

    for (const comando of comandos) {
      console.log(`  ${comando.recurso} ${comando.acao}`);
      console.log(`      ${comando.descricao}`);
    }

    console.log("  ajuda - mostra esta lista");
    console.log("  sair  - encerra o programa\n");
  }

  private montarPrompt(): string {
    if (!this.sessaoAtual) {
      return "greencode> ";
    }
    return `greencode (${this.sessaoAtual.usuario}/${this.sessaoAtual.papel})> `;
  }

  private formatar(severidade: Severidade, mensagem: string): string {
    return `[${severidade}] ${mensagem}`;
  }

  private completar(linha: string): [string[], string] {
    const papel = this.sessaoAtual ? this.sessaoAtual.papel : null;
    const comandos = this.despachante.listarComandosDisponiveis(papel);

    const candidatos = new Set<string>(["ajuda", "sair"]);
    for (const comando of comandos) {
      candidatos.add(`${comando.recurso} ${comando.acao} `);
    }

    const lista = [...candidatos];
    const combinam = lista.filter((candidato) => candidato.startsWith(linha));
    return [combinam.length > 0 ? combinam : lista, linha];
  }

  private persistirHistorico(): void {
    if (!this.rl) {
      return;
    }
    const historicoAtual = (this.rl as unknown as { history: string[] }).history ?? [];
    salvarHistorico(this.caminhoHistorico, historicoAtual, TAMANHO_MAX_HISTORICO);
  }
}