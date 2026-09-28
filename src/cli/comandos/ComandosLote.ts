import { Despachante, Severidade, ComandoDefinido } from "../Despachante";
import { ServicoLote } from "../../services/ServicoLote";
import { PapelUsuario } from "../../domain/enums/PapelUsuario";
import { exigirFlag, analisarData } from "../ComandoUtils";

const PAPEIS_GESTAO_LOTE = [PapelUsuario.GESTOR_ALMOXARIFADO, PapelUsuario.ADMINISTRADOR];

export function registrarComandosLote(despachante: Despachante, servicoLote: ServicoLote): void {
  const criarLote: ComandoDefinido = {
    recurso: "lote",
    acao: "criar",
    requerAutenticacao: true,
    papeisPermitidos: PAPEIS_GESTAO_LOTE,
    descricao:
      "Cria um lote. Uso: lote criar --org <id> --nf <notaFiscal> --transp <transportadora> [--dataEntrada <AAAA-MM-DD>] [--observacoes <texto>]",
    executar: (ctx) => {
      const organizacaoId = exigirFlag(ctx.flags, "org");
      const notaFiscal = exigirFlag(ctx.flags, "nf");
      const transportadora = exigirFlag(ctx.flags, "transp");
      const dataEntrada = ctx.flags.dataEntrada ? analisarData(ctx.flags.dataEntrada, "dataEntrada") : new Date();
      const observacoes = ctx.flags.observacoes;

      const lote = servicoLote.criarLote(
        {
          dataEntrada,
          organizacaoId,
          notaFiscal,
          transportadora,
          ...(observacoes !== undefined ? { observacoes } : {})
        },
        ctx.sessao!.usuario
      );

      return {
        severidade: Severidade.SUCESSO,
        mensagem: `Lote criado: ${lote.id} (status: ${lote.statusProcessamento})`
      };
    }
  };

  const buscarLote: ComandoDefinido = {
    recurso: "lote",
    acao: "buscar",
    requerAutenticacao: true,
    papeisPermitidos: [],
    descricao: "Busca um lote por id. Uso: lote buscar --id <id>",
    executar: (ctx) => {
      const id = exigirFlag(ctx.flags, "id");
      const lote = servicoLote.buscarLote(id);

      if (!lote) {
        return { severidade: Severidade.ERRO, mensagem: `Lote '${id}' não encontrado.` };
      }

      return { severidade: Severidade.INFO, mensagem: lote.gerarRelatorioTriagem() };
    }
  };

  const listarPorPeriodo: ComandoDefinido = {
    recurso: "lote",
    acao: "listar-periodo",
    requerAutenticacao: true,
    papeisPermitidos: [],
    descricao: "Lista lotes recebidos em um período. Uso: lote listar-periodo --inicio <AAAA-MM-DD> --fim <AAAA-MM-DD>",
    executar: (ctx) => {
      const inicio = analisarData(exigirFlag(ctx.flags, "inicio"), "inicio");
      const fim = analisarData(exigirFlag(ctx.flags, "fim"), "fim");
      fim.setHours(23, 59, 59, 999);

      const lotes = servicoLote.consultarLotePorPeriodo(inicio, fim);

      if (lotes.length === 0) {
        return { severidade: Severidade.INFO, mensagem: "Nenhum lote encontrado no período informado." };
      }

      const linhas = lotes.map(
        (lote) =>
          `- ${lote.id} | NF ${lote.notaFiscal} | ${lote.dataEntrada.toISOString().slice(0, 10)} | Status: ${lote.statusProcessamento}`
      );
      return { severidade: Severidade.INFO, mensagem: linhas.join("\n") };
    }
  };

  const processarTriagem: ComandoDefinido = {
    recurso: "lote",
    acao: "processar-triagem",
    requerAutenticacao: true,
    papeisPermitidos: PAPEIS_GESTAO_LOTE,
    descricao:
      "Avança uma etapa na triagem do lote (RECEBIDO->EM_TRIAGEM ou EM_TRIAGEM->TRIAGEM_CONCLUIDA). Uso: lote processar-triagem --id <id>",
    executar: (ctx) => {
      const id = exigirFlag(ctx.flags, "id");
      servicoLote.processarTriagem(id, ctx.sessao!.usuario);
      const lote = servicoLote.buscarLote(id)!;

      return {
        severidade: Severidade.SUCESSO,
        mensagem: `Triagem avançada. Lote '${id}' agora está em status: ${lote.statusProcessamento}`
      };
    }
  };

  despachante.registrar(criarLote);
  despachante.registrar(buscarLote);
  despachante.registrar(listarPorPeriodo);
  despachante.registrar(processarTriagem);
}