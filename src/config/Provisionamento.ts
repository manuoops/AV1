import * as fs from "fs";
import * as path from "path";
import { CriptografiaArquivo } from "../infra/CriptografiaArquivo";
import { RepositorioArquivo } from "../infra/RepositorioArquivo";
import { JournalTransacao } from "../infra/JournalTransacao";
import { ServicoAutenticacao } from "../services/ServicoAutenticacao";
import { PapelUsuario } from "../domain/enums/PapelUsuario";

const NOME_ARQUIVO_CONFIG_MESTRE = "config.master.json";
const USUARIO_ADMIN_PADRAO = "admin";

export interface ConfigMestre {
  chaveCriptografia: string;
  criadoEm: string;
}

export interface ContextoInicializacao {
  repositorio: RepositorioArquivo;
  provisionamentoRealizado: boolean;
}

export async function inicializarSistema(
  diretorioBase: string,
  perguntar: (pergunta: string) => Promise<string>
): Promise<ContextoInicializacao> {
  fs.mkdirSync(diretorioBase, { recursive: true });
  const caminhoConfig = path.join(diretorioBase, NOME_ARQUIVO_CONFIG_MESTRE);
  const cripto = new CriptografiaArquivo();

  if (fs.existsSync(caminhoConfig)) {
    const config = JSON.parse(fs.readFileSync(caminhoConfig, "utf8")) as ConfigMestre;
    const repositorio = new RepositorioArquivo(diretorioBase, cripto, config.chaveCriptografia);
    JournalTransacao.configurar(repositorio, diretorioBase);
    return { repositorio, provisionamentoRealizado: false };
  }

  return await executarProvisionamentoInicial(diretorioBase, caminhoConfig, cripto, perguntar);
}

async function executarProvisionamentoInicial(
  diretorioBase: string,
  caminhoConfig: string,
  cripto: CriptografiaArquivo,
  perguntar: (pergunta: string) => Promise<string>
): Promise<ContextoInicializacao> {
  console.log("\n=== Provisionamento inicial do greencode ===");
  console.log("Nenhuma configuração encontrada. Vamos criar o primeiro administrador.\n");

  let senhaAdmin = "";
  while (senhaAdmin.trim().length === 0) {
    senhaAdmin = await perguntar("Defina a senha do administrador inicial: ");
    if (senhaAdmin.trim().length === 0) {
      console.log("A senha não pode ser vazia.");
    }
  }

  const chave = cripto.gerarChave();
  const config: ConfigMestre = { chaveCriptografia: chave, criadoEm: new Date().toISOString() };
  fs.writeFileSync(caminhoConfig, JSON.stringify(config, null, 2), "utf8");

  const repositorio = new RepositorioArquivo(diretorioBase, cripto, chave);
  JournalTransacao.configurar(repositorio, diretorioBase);

  const servicoAutenticacao = new ServicoAutenticacao(repositorio);
  servicoAutenticacao.cadastrarUsuario(USUARIO_ADMIN_PADRAO, senhaAdmin, PapelUsuario.ADMINISTRADOR, "provisionamento-inicial");

  console.log(`\nAdministrador '${USUARIO_ADMIN_PADRAO}' criado com sucesso. Guarde essa senha em local seguro.\n`);

  return { repositorio, provisionamentoRealizado: true };
}