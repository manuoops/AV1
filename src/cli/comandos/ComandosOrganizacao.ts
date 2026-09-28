import { Despachante, Severidade, ComandoDefinido } from "../Despachante";
import { ServicoOrganizacao } from "../../services/ServicoOrganizacao";
import { PapelUsuario } from "../../domain/enums/PapelUsuario";
import { exigirFlag, analisarData, analisarNumero, analisarBooleano, analisarLista } from "../ComandoUtils";

const PAPEIS_GESTAO_ORGANIZACAO = [PapelUsuario.OPERADOR_CADASTRO, PapelUsuario.ADMINISTRADOR];

export function registrarComandosOrganizacao(despachante: Despachante, servicoOrganizacao: ServicoOrganizacao): void {
  const cadastrarOrganizacao: ComandoDefinido = {
    recurso: "organizacao",
    acao: "cadastrar",
    requerAutenticacao: true,
    papeisPermitidos: PAPEIS_GESTAO_ORGANIZACAO,
    descricao:
      "Cadastra uma organização. Uso: organizacao cadastrar --razaoSocial <nome> --cnpj <cnpj> --inscricaoEstadual <ie> --endereco <endereco> --telefone <tel> --email <email>",
    executar: (ctx) => {
      const razaoSocial = exigirFlag(ctx.flags, "razaoSocial");
      const cnpj = exigirFlag(ctx.flags, "cnpj");
      const inscricaoEstadual = exigirFlag(ctx.flags, "inscricaoEstadual");
      const enderecoCompleto = exigirFlag(ctx.flags, "endereco");
      const telefone = exigirFlag(ctx.flags, "telefone");
      const email = exigirFlag(ctx.flags, "email");

      const organizacao = servicoOrganizacao.cadastrarOrganizacao(
        { razaoSocial, cnpj, inscricaoEstadual, enderecoCompleto, telefone, email },
        ctx.sessao!.usuario
      );

      return {
        severidade: Severidade.SUCESSO,
        mensagem: `Organização cadastrada: ${organizacao.id} (${organizacao.razaoSocial})`
      };
    }
  };

  const buscarOrganizacao: ComandoDefinido = {
    recurso: "organizacao",
    acao: "buscar",
    requerAutenticacao: true,
    papeisPermitidos: [],
    descricao: "Busca uma organização por id. Uso: organizacao buscar --id <id>",
    executar: (ctx) => {
      const id = exigirFlag(ctx.flags, "id");
      const organizacao = servicoOrganizacao.buscarOrganizacao(id);

      if (!organizacao) {
        return { severidade: Severidade.ERRO, mensagem: `Organização '${id}' não encontrada.` };
      }

      const linhas = [
        `Organização: ${organizacao.razaoSocial}`,
        `CNPJ: ${organizacao.cnpj}`,
        `Status: ${organizacao.ativo ? "ATIVA" : "INATIVA"}`,
        `Endereço: ${organizacao.enderecoCompleto}`,
        `Contrato vigente: ${organizacao.contratoVigente ? organizacao.contratoVigente.id : "(nenhum)"}`
      ];

      return { severidade: Severidade.INFO, mensagem: linhas.join("\n") };
    }
  };

  const listarOrganizacoes: ComandoDefinido = {
    recurso: "organizacao",
    acao: "listar",
    requerAutenticacao: true,
    papeisPermitidos: [],
    descricao: "Lista organizações ativas.",
    executar: () => {
      const organizacoes = servicoOrganizacao.listarOrganizacoesAtivas();

      if (organizacoes.length === 0) {
        return { severidade: Severidade.INFO, mensagem: "Nenhuma organização ativa cadastrada." };
      }

      const linhas = organizacoes.map((org) => `- ${org.id} | ${org.razaoSocial} | CNPJ ${org.cnpj}`);
      return { severidade: Severidade.INFO, mensagem: linhas.join("\n") };
    }
  };

  const cadastrarContrato: ComandoDefinido = {
    recurso: "contrato",
    acao: "cadastrar",
    requerAutenticacao: true,
    papeisPermitidos: PAPEIS_GESTAO_ORGANIZACAO,
    descricao:
      "Cadastra um contrato. Uso: contrato cadastrar --org <id> --vencimento <AAAA-MM-DD> --valorMensal <numero> [--renovacaoAutomatica] [--clausulas \"a;b;c\"]",
    executar: (ctx) => {
      const organizacaoId = exigirFlag(ctx.flags, "org");
      const dataVencimento = analisarData(exigirFlag(ctx.flags, "vencimento"), "vencimento");
      const valorMensal = analisarNumero(exigirFlag(ctx.flags, "valorMensal"), "valorMensal");
      const renovacaoAutomatica = analisarBooleano(ctx.flags.renovacaoAutomatica);
      const clausulas = analisarLista(ctx.flags.clausulas);

      const contrato = servicoOrganizacao.cadastrarContrato(
        { organizacaoId, dataVencimento, clausulas, valorMensal, renovacaoAutomatica },
        ctx.sessao!.usuario
      );

      return {
        severidade: Severidade.SUCESSO,
        mensagem: `Contrato cadastrado: ${contrato.id} (vencimento: ${contrato.dataVencimento.toISOString().slice(0, 10)})`
      };
    }
  };

  const renovarContrato: ComandoDefinido = {
    recurso: "contrato",
    acao: "renovar",
    requerAutenticacao: true,
    papeisPermitidos: PAPEIS_GESTAO_ORGANIZACAO,
    descricao: "Renova o contrato vigente de uma organização. Uso: contrato renovar --org <id> --vencimento <AAAA-MM-DD>",
    executar: (ctx) => {
      const organizacaoId = exigirFlag(ctx.flags, "org");
      const novoVencimento = analisarData(exigirFlag(ctx.flags, "vencimento"), "vencimento");

      servicoOrganizacao.renovarContrato(organizacaoId, novoVencimento, ctx.sessao!.usuario);

      return {
        severidade: Severidade.SUCESSO,
        mensagem: `Contrato da organização '${organizacaoId}' renovado até ${novoVencimento.toISOString().slice(0, 10)}.`
      };
    }
  };

  despachante.registrar(cadastrarOrganizacao);
  despachante.registrar(buscarOrganizacao);
  despachante.registrar(listarOrganizacoes);
  despachante.registrar(cadastrarContrato);
  despachante.registrar(renovarContrato);
}