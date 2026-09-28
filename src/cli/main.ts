import * as readline from "readline";
import * as path from "path";
import { inicializarSistema } from "../config/Provisionamento";
import { ServicoAutenticacao } from "../services/ServicoAutenticacao";
import { ServicoOrganizacao } from "../services/ServicoOrganizacao";
import { ServicoLote } from "../services/ServicoLote";
import { ServicoEquipamento } from "../services/ServicoEquipamento";
import { ServicoRelatorio } from "../services/ServicoRelatorio";
import { CLIInterface } from "./CLIInterface";
import { LeitorLinhaUnico } from "./LeitorLinhaUnico";
import { carregarHistorico } from "./HistoricoComandos";

const DIRETORIO_DADOS = process.env.GREENCODE_DATA_DIR
  ? path.resolve(process.env.GREENCODE_DATA_DIR)
  : path.join(process.cwd(), "data");

const NOME_ARQUIVO_HISTORICO = ".greencode_history";
const TAMANHO_MAX_HISTORICO = 200;

async function main(): Promise<void> {
  const caminhoHistorico = path.join(DIRETORIO_DADOS, NOME_ARQUIVO_HISTORICO);

  let completerAtual: (linha: string) => [string[], string] = (linha) => [[], linha];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    history: carregarHistorico(caminhoHistorico, TAMANHO_MAX_HISTORICO),
    completer: (linha: string) => completerAtual(linha)
  });

  const leitor = new LeitorLinhaUnico(rl);

  const { repositorio } = await inicializarSistema(DIRETORIO_DADOS, (pergunta) => leitor.perguntar(pergunta));

  const servicos = {
    autenticacao: new ServicoAutenticacao(repositorio),
    organizacao: new ServicoOrganizacao(repositorio),
    lote: new ServicoLote(repositorio),
    equipamento: new ServicoEquipamento(repositorio),
    relatorio: new ServicoRelatorio(repositorio)
  };

  const cli = new CLIInterface(servicos, DIRETORIO_DADOS);
  completerAtual = cli.obterCompleter();
  cli.iniciarLoop(leitor);
}

main().catch((erro) => {
  console.error("Erro fatal ao iniciar o greencode:", erro);
  process.exit(1);
});