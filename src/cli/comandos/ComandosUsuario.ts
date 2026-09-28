import { Despachante, Severidade, ComandoDefinido } from "../Despachante";
import { ServicoAutenticacao } from "../../services/ServicoAutenticacao";
import { PapelUsuario } from "../../domain/enums/PapelUsuario";

export function registrarComandosUsuario(despachante: Despachante, servicoAutenticacao: ServicoAutenticacao): void {
  const login: ComandoDefinido = {
    recurso: "usuario",
    acao: "login",
    requerAutenticacao: false,
    papeisPermitidos: [],
    descricao: "Autentica um usuário e inicia uma sessão. Uso: usuario login --usuario <nome> --senha <senha>",
    executar: (ctx) => {
      const usuario = ctx.flags.usuario;
      const senha = ctx.flags.senha;
      if (!usuario || !senha) {
        throw new Error("Uso: usuario login --usuario <nome> --senha <senha>");
      }

      const sessao = servicoAutenticacao.login(usuario, senha);
      return {
        severidade: Severidade.SUCESSO,
        mensagem: `Login bem-sucedido. Bem-vindo(a), ${sessao.usuario}! (papel: ${sessao.papel})`,
        novaSessao: sessao
      };
    }
  };

  const logout: ComandoDefinido = {
    recurso: "usuario",
    acao: "logout",
    requerAutenticacao: true,
    papeisPermitidos: [],
    descricao: "Encerra a sessão.",
    executar: (ctx) => {
      servicoAutenticacao.logout(ctx.sessao!.token);
      return {
        severidade: Severidade.SUCESSO,
        mensagem: "Logout realizado com sucesso.",
        novaSessao: null
      };
    }
  };

  const cadastrar: ComandoDefinido = {
    recurso: "usuario",
    acao: "cadastrar",
    requerAutenticacao: true,
    papeisPermitidos: [PapelUsuario.ADMINISTRADOR],
    descricao: "Cadastra um novo usuário. Uso: usuario cadastrar --usuario <nome> --senha <senha> --papel <PAPEL>",
    executar: (ctx) => {
      const { usuario, senha, papel } = ctx.flags;
      if (!usuario || !senha || !papel) {
        throw new Error("Uso: usuario cadastrar --usuario <nome> --senha <senha> --papel <PAPEL>");
      }

      const papeisValidos = Object.values(PapelUsuario);
      if (!papeisValidos.includes(papel as PapelUsuario)) {
        throw new Error(`Papel inválido: '${papel}'. Valores aceitos: ${papeisValidos.join(", ")}`);
      }

      servicoAutenticacao.cadastrarUsuario(usuario, senha, papel as PapelUsuario, ctx.sessao!.usuario);
      return {
        severidade: Severidade.SUCESSO,
        mensagem: `Usuário '${usuario}' cadastrado com papel ${papel}.`
      };
    }
  };

  const alterarSenha: ComandoDefinido = {
    recurso: "usuario",
    acao: "alterar-senha",
    requerAutenticacao: true,
    papeisPermitidos: [],
    descricao: "Altera a própria senha. Uso: usuario alterar-senha --senhaAntiga <atual> --senhaNova <nova>",
    executar: (ctx) => {
      const { senhaAntiga, senhaNova } = ctx.flags;
      if (!senhaAntiga || !senhaNova) {
        throw new Error("Uso: usuario alterar-senha --senhaAntiga <atual> --senhaNova <nova>");
      }

      const sucesso = servicoAutenticacao.alterarSenha(ctx.sessao!.usuario, senhaAntiga, senhaNova);
      if (!sucesso) {
        return {
          severidade: Severidade.ERRO,
          mensagem: "Não foi possível alterar a senha. Verifique se a senha antiga está correta."
        };
      }

      return { severidade: Severidade.SUCESSO, mensagem: "Senha alterada com sucesso." };
    }
  };

  despachante.registrar(login);
  despachante.registrar(logout);
  despachante.registrar(cadastrar);
  despachante.registrar(alterarSenha);
}