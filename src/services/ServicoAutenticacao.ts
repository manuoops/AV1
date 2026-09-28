import { Credencial, CredencialPersistida } from "../domain/entities/Credencial";
import { Sessao, SessaoPersistida } from "../domain/entities/Sessao";
import { PapelUsuario } from "../domain/enums/PapelUsuario";
import { RepositorioArquivo } from "../infra/RepositorioArquivo";
import { JournalTransacao } from "../infra/JournalTransacao";

const ARQUIVO_CREDENCIAIS = "credenciais.json";
const ARQUIVO_SESSOES = "sessoes.json";

const MENSAGEM_LOGIN_INVALIDO = "Usuário ou senha invalidos.";

export class ServicoAutenticacao {
  private readonly repositorio: RepositorioArquivo;

  constructor(repositorio: RepositorioArquivo) {
    this.repositorio = repositorio;
  }

  public cadastrarUsuario(
    usuario: string,
    senhaPlana: string,
    papel: PapelUsuario,
    usuarioResponsavel: string
  ): void {
    if (!this.ehTextoValido(usuario)) {
      throw new Error("Nome de usuário não pode ser vazio.");
    }

    const existente = this.repositorio.carregarEntidade<CredencialPersistida>(
      ARQUIVO_CREDENCIAIS,
      usuario
    );
    if (existente) {
      throw new Error(`Usuário '${usuario}' já está cadastrado.`);
    }

    const credencial = Credencial.criar(usuario, senhaPlana, papel);

    const transacao = new JournalTransacao({
      operacao: "CADASTRAR_USUARIO",
      entidade: "Credencial",
      dadosAntes: null,
      dadosDepois: { usuario, papel },
      usuarioResponsavel
    });
    transacao.registrar();

    this.repositorio.salvarEntidade(ARQUIVO_CREDENCIAIS, credencial);
  }

  public login(usuario: string, senha: string): Sessao {
    if (!this.ehTextoValido(usuario) || !this.ehTextoValido(senha)) {
      throw new Error(MENSAGEM_LOGIN_INVALIDO);
    }

    const dadosCredencial = this.repositorio.carregarEntidade<CredencialPersistida>(
      ARQUIVO_CREDENCIAIS,
      usuario
    );
    if (!dadosCredencial) {
      throw new Error(MENSAGEM_LOGIN_INVALIDO);
    }

    const credencial = new Credencial(dadosCredencial);
    if (!credencial.verificarSenha(senha)) {
      throw new Error(MENSAGEM_LOGIN_INVALIDO);
    }

    credencial.atualizarUltimoAcesso();
    this.repositorio.salvarEntidade(ARQUIVO_CREDENCIAIS, credencial);

    const sessao = Sessao.criar(credencial.usuario, credencial.papel);

    const transacao = new JournalTransacao({
      operacao: "LOGIN",
      entidade: "Sessao",
      dadosAntes: null,
      dadosDepois: { usuario: sessao.usuario, sessaoId: sessao.id },
      usuarioResponsavel: usuario
    });
    transacao.registrar();

    this.repositorio.salvarEntidade(ARQUIVO_SESSOES, sessao);

    return sessao;
  }

  public logout(token: string): void {
    const dadosSessao = this.repositorio.carregarEntidade<SessaoPersistida>(ARQUIVO_SESSOES, token);
    if (!dadosSessao) {
      return;
    }

    const transacao = new JournalTransacao({
      operacao: "LOGOUT",
      entidade: "Sessao",
      dadosAntes: { usuario: dadosSessao.usuario, sessaoId: dadosSessao.id },
      dadosDepois: null,
      usuarioResponsavel: dadosSessao.usuario
    });
    transacao.registrar();

    this.repositorio.excluirEntidade(ARQUIVO_SESSOES, token);
  }

  public validarToken(token: string): boolean {
    if (!this.ehTextoValido(token)) {
      return false;
    }

    const dadosSessao = this.repositorio.carregarEntidade<SessaoPersistida>(ARQUIVO_SESSOES, token);
    if (!dadosSessao) {
      return false;
    }

    const sessao = new Sessao(dadosSessao);

    if (!sessao.isValida()) {
      this.repositorio.excluirEntidade(ARQUIVO_SESSOES, token);
      return false;
    }

    sessao.renovar();
    this.repositorio.salvarEntidade(ARQUIVO_SESSOES, sessao);
    return true;
  }

  public alterarSenha(usuario: string, senhaAntiga: string, senhaNova: string): boolean {
    if (!this.ehTextoValido(usuario) || !this.ehTextoValido(senhaAntiga) || !this.ehTextoValido(senhaNova)) {
      return false;
    }

    const dadosCredencial = this.repositorio.carregarEntidade<CredencialPersistida>(
      ARQUIVO_CREDENCIAIS,
      usuario
    );
    if (!dadosCredencial) {
      return false;
    }

    const credencial = new Credencial(dadosCredencial);
    if (!credencial.verificarSenha(senhaAntiga)) {
      return false;
    }

    try {
      credencial.redefinirSenha(senhaNova);
    } catch {
      return false;
    }

    const transacao = new JournalTransacao({
      operacao: "ALTERAR_SENHA",
      entidade: "Credencial",
      dadosAntes: { usuario },
      dadosDepois: { usuario, alteradoEm: new Date().toISOString() },
      usuarioResponsavel: usuario
    });
    transacao.registrar();

    this.repositorio.salvarEntidade(ARQUIVO_CREDENCIAIS, credencial);
    return true;
  }

  private ehTextoValido(texto: string | null | undefined): boolean {
    return typeof texto === "string" && texto.trim().length > 0;
  }
}