import { Despachante, Severidade, ComandoDefinido } from "../Despachante";
import { ServicoEquipamento } from "../../services/ServicoEquipamento";
import { PapelUsuario } from "../../domain/enums/PapelUsuario";
import { TipoEquipamento } from "../../domain/enums/TipoEquipamento";
import { EstadoFisico } from "../../domain/enums/EstadoFisico";
import { StatusRastreamento } from "../../domain/enums/StatusRastreamento";
import { exigirFlag, analisarNumero, analisarEnum } from "../ComandoUtils";

const PAPEIS_GESTAO_EQUIPAMENTO = [PapelUsuario.GESTOR_ALMOXARIFADO, PapelUsuario.ADMINISTRADOR];

export function registrarComandosEquipamento(despachante: Despachante, servicoEquipamento: ServicoEquipamento): void {
  const cadastrar: ComandoDefinido = {
    recurso: "equipamento",
    acao: "cadastrar",
    requerAutenticacao: true,
    papeisPermitidos: PAPEIS_GESTAO_EQUIPAMENTO,
    descricao:
      "Cadastra um equipamento em um lote. Uso: equipamento cadastrar --lote <id> --tipo <TIPO> --marca <marca> --modelo <modelo> --ano <ano> --estado <ESTADO_FISICO> --peso <kg>",
    executar: (ctx) => {
      const loteId = exigirFlag(ctx.flags, "lote");
      const tipo = analisarEnum(exigirFlag(ctx.flags, "tipo"), Object.values(TipoEquipamento), "tipo");
      const marca = exigirFlag(ctx.flags, "marca");
      const modelo = exigirFlag(ctx.flags, "modelo");
      const anoFabricacao = analisarNumero(exigirFlag(ctx.flags, "ano"), "ano");
      const estadoFisico = analisarEnum(exigirFlag(ctx.flags, "estado"), Object.values(EstadoFisico), "estado");
      const pesoQuilogramas = analisarNumero(exigirFlag(ctx.flags, "peso"), "peso");

      const equipamento = servicoEquipamento.cadastrarEquipamento(
        { tipo, marca, modelo, anoFabricacao, estadoFisico, pesoQuilogramas, loteId },
        ctx.sessao!.usuario
      );

      return {
        severidade: Severidade.SUCESSO,
        mensagem: `Equipamento cadastrado: ${equipamento.id} (código: ${equipamento.codigoBarrasInterno}, posição no lote: ${equipamento.posicaoNoLote})`
      };
    }
  };

  const rastrear: ComandoDefinido = {
    recurso: "equipamento",
    acao: "rastrear",
    requerAutenticacao: true,
    papeisPermitidos: [],
    descricao: "Mostra o histórico completo de rastreabilidade de um equipamento. Uso: equipamento rastrear --id <id>",
    executar: (ctx) => {
      const id = exigirFlag(ctx.flags, "id");
      const historico = servicoEquipamento.rastrearEquipamento(id);

      const linhas = [
        `Equipamento: ${historico.equipamento.codigoBarrasInterno} (${historico.equipamento.tipo})`,
        `Marca/Modelo: ${historico.equipamento.marca} ${historico.equipamento.modelo}`,
        `Estado físico: ${historico.equipamento.estadoFisico}`,
        `Status de rastreamento: ${historico.equipamento.statusRastreamento}`,
        `Lote: ${historico.lote ? historico.lote.id : "(desconhecido)"}`,
        `Organização geradora: ${historico.organizacao ? historico.organizacao.razaoSocial : "(desconhecida)"}`,
        `Depreciação estimada: ${(historico.equipamento.calcularDepreciacao() * 100).toFixed(0)}%`,
        "",
        `Histórico de movimentações (${historico.movimentacoes.length}):`
      ];

      for (const movimentacao of historico.movimentacoes) {
        linhas.push(
          `  ${movimentacao.dataHora.toISOString()} | ${movimentacao.origem} -> ${movimentacao.destino} | responsável: ${movimentacao.responsavel}`
        );
      }

      return { severidade: Severidade.INFO, mensagem: linhas.join("\n") };
    }
  };

  const atualizarEstado: ComandoDefinido = {
    recurso: "equipamento",
    acao: "atualizar-estado",
    requerAutenticacao: true,
    papeisPermitidos: PAPEIS_GESTAO_EQUIPAMENTO,
    descricao:
      "Atualiza o estado físico. Uso: equipamento atualizar-estado --id <id> --estado <ESTADO_FISICO> [--justificativa <texto>] (justificativa obrigatória se a queda for de 2+ categorias)",
    executar: (ctx) => {
      const id = exigirFlag(ctx.flags, "id");
      const novoEstado = analisarEnum(exigirFlag(ctx.flags, "estado"), Object.values(EstadoFisico), "estado");
      const justificativa = ctx.flags.justificativa;

      servicoEquipamento.atualizarEstadoFisico(id, novoEstado, ctx.sessao!.usuario, justificativa);

      return {
        severidade: Severidade.SUCESSO,
        mensagem: `Estado físico do equipamento '${id}' atualizado para ${novoEstado}.`
      };
    }
  };

  const atualizarStatus: ComandoDefinido = {
    recurso: "equipamento",
    acao: "atualizar-status",
    requerAutenticacao: true,
    papeisPermitidos: PAPEIS_GESTAO_EQUIPAMENTO,
    descricao:
      "Atualiza o status de rastreamento. Uso: equipamento atualizar-status --id <id> --status <STATUS> --justificativa <texto> (justificativa sempre obrigatória)",
    executar: (ctx) => {
      const id = exigirFlag(ctx.flags, "id");
      const novoStatus = analisarEnum(exigirFlag(ctx.flags, "status"), Object.values(StatusRastreamento), "status");
      const justificativa = exigirFlag(ctx.flags, "justificativa");

      servicoEquipamento.atualizarStatusRastreamento(id, novoStatus, justificativa, ctx.sessao!.usuario);

      return {
        severidade: Severidade.SUCESSO,
        mensagem: `Status de rastreamento do equipamento '${id}' atualizado para ${novoStatus}.`
      };
    }
  };

  const movimentar: ComandoDefinido = {
    recurso: "equipamento",
    acao: "movimentar",
    requerAutenticacao: true,
    papeisPermitidos: PAPEIS_GESTAO_EQUIPAMENTO,
    descricao: "Registra uma movimentação física. Uso: equipamento movimentar --id <id> --destino <local> --responsavel <nome>",
    executar: (ctx) => {
      const id = exigirFlag(ctx.flags, "id");
      const destino = exigirFlag(ctx.flags, "destino");
      const responsavel = exigirFlag(ctx.flags, "responsavel");

      servicoEquipamento.registrarMovimentacao(id, destino, responsavel, ctx.sessao!.usuario);

      return {
        severidade: Severidade.SUCESSO,
        mensagem: `Movimentação registrada: equipamento '${id}' -> ${destino}.`
      };
    }
  };

  despachante.registrar(cadastrar);
  despachante.registrar(rastrear);
  despachante.registrar(atualizarEstado);
  despachante.registrar(atualizarStatus);
  despachante.registrar(movimentar);
}