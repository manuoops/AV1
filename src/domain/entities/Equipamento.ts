import * as crypto from "crypto";
import { TipoEquipamento } from "../enums/TipoEquipamento";
import { EstadoFisico } from "../enums/EstadoFisico";
import { StatusRastreamento } from "../enums/StatusRastreamento";
import { Movimentacao, MovimentacaoPersistida } from "./Movimentacao";

const TAXA_DEPRECIACAO_ANUAL_PADRAO = 0.2;
const ANO_MINIMO_FABRICACAO = 1980;

const ORDEM_STATUS_RASTREAMENTO: Record<StatusRastreamento, number> = {
  [StatusRastreamento.AGUARDANDO_TRIAGEM]: 0,
  [StatusRastreamento.EM_TRIAGEM]: 1,
  [StatusRastreamento.AGUARDANDO_DESMONTE]: 2,
  [StatusRastreamento.EM_DESMONTE]: 3,
  [StatusRastreamento.PECAS_REAPROVEITADAS]: 4,
  [StatusRastreamento.MATERIAL_RECICLAVEL]: 4,
  [StatusRastreamento.DESCARTE_SEGURO]: 4,
  [StatusRastreamento.BAIXA_DEFINITIVA]: 5
};

const ORDEM_ESTADO_FISICO: Record<EstadoFisico, number> = {
  [EstadoFisico.NOVO]: 0,
  [EstadoFisico.BOM_ESTADO]: 1,
  [EstadoFisico.USADO_LEVE]: 2,
  [EstadoFisico.USADO_MODERADO]: 3,
  [EstadoFisico.DANIFICADO_LEVE]: 4,
  [EstadoFisico.DANIFICADO_GRAVE]: 5,
  [EstadoFisico.INSERVIVEL]: 6
};

const QUEDA_MINIMA_QUE_EXIGE_JUSTIFICATIVA = 2;

export interface EquipamentoPersistido {
  id: string;
  codigoBarrasInterno: string;
  tipo: TipoEquipamento;
  marca: string;
  modelo: string;
  anoFabricacao: number;
  estadoFisico: EstadoFisico;
  pesoQuilogramas: number;
  loteId: string;
  posicaoNoLote: number;
  statusRastreamento: StatusRastreamento;
  historicoMovimentacao: MovimentacaoPersistida[];
}

export class Equipamento {
  public readonly id: string;
  public readonly codigoBarrasInterno: string;
  public readonly tipo: TipoEquipamento;
  public marca: string;
  public modelo: string;
  public readonly anoFabricacao: number;
  public estadoFisico: EstadoFisico;
  public readonly pesoQuilogramas: number;
  public readonly loteId: string;
  public readonly posicaoNoLote: number;
  public statusRastreamento: StatusRastreamento;
  private historicoMovimentacao: Movimentacao[];

  constructor(dados: EquipamentoPersistido) {
    this.id = dados.id;
    this.codigoBarrasInterno = dados.codigoBarrasInterno;
    this.tipo = dados.tipo;
    this.marca = dados.marca;
    this.modelo = dados.modelo;
    this.anoFabricacao = dados.anoFabricacao;
    this.estadoFisico = dados.estadoFisico;
    this.pesoQuilogramas = dados.pesoQuilogramas;
    this.loteId = dados.loteId;
    this.posicaoNoLote = dados.posicaoNoLote;
    this.statusRastreamento = dados.statusRastreamento;
    this.historicoMovimentacao = dados.historicoMovimentacao.map((m) => new Movimentacao(m));
  }

  public static criar(dados: {
    codigoBarrasInterno: string;
    tipo: TipoEquipamento;
    marca: string;
    modelo: string;
    anoFabricacao: number;
    estadoFisico: EstadoFisico;
    pesoQuilogramas: number;
    loteId: string;
    posicaoNoLote: number;
  }): Equipamento {
    if (!dados.codigoBarrasInterno || dados.codigoBarrasInterno.trim().length === 0) {
      throw new Error("codigoBarrasInterno é obrigatório.");
    }
    if (!dados.marca || dados.marca.trim().length === 0) {
      throw new Error("marca é obrigatória.");
    }
    if (!dados.modelo || dados.modelo.trim().length === 0) {
      throw new Error("modelo é obrigatório.");
    }
    if (!dados.loteId || dados.loteId.trim().length === 0) {
      throw new Error("loteId é obrigatório.");
    }
    const anoAtual = new Date().getFullYear();
    if (dados.anoFabricacao < ANO_MINIMO_FABRICACAO || dados.anoFabricacao > anoAtual) {
      throw new Error(`anoFabricacao deve estar entre ${ANO_MINIMO_FABRICACAO} e ${anoAtual}.`);
    }
    if (!(dados.pesoQuilogramas > 0)) {
      throw new Error("pesoQuilogramas deve ser um número positivo.");
    }
    if (!Number.isInteger(dados.posicaoNoLote) || dados.posicaoNoLote < 1) {
      throw new Error("posicaoNoLote deve ser um número inteiro positivo.");
    }

    return new Equipamento({
      id: crypto.randomUUID(),
      codigoBarrasInterno: dados.codigoBarrasInterno,
      tipo: dados.tipo,
      marca: dados.marca,
      modelo: dados.modelo,
      anoFabricacao: dados.anoFabricacao,
      estadoFisico: dados.estadoFisico,
      pesoQuilogramas: dados.pesoQuilogramas,
      loteId: dados.loteId,
      posicaoNoLote: dados.posicaoNoLote,
      statusRastreamento: StatusRastreamento.AGUARDANDO_TRIAGEM,
      historicoMovimentacao: []
    });
  }

  public listarHistoricoMovimentacao(): Movimentacao[] {
    return [...this.historicoMovimentacao];
  }

  public atualizarStatus(novoStatus: StatusRastreamento, justificativa: string): void {
    if (!justificativa || justificativa.trim().length === 0) {
      throw new Error("Justificativa é obrigatória para atualizar o status de rastreamento.");
    }

    const entrandoEmDesmonte =
      novoStatus === StatusRastreamento.AGUARDANDO_DESMONTE || novoStatus === StatusRastreamento.EM_DESMONTE;
    const aindaNaoTriado = ORDEM_STATUS_RASTREAMENTO[this.statusRastreamento] < ORDEM_STATUS_RASTREAMENTO[StatusRastreamento.EM_TRIAGEM];

    if (entrandoEmDesmonte && aindaNaoTriado) {
      throw new Error(
        "Equipamento só pode ir para desmonte depois de passar por triagem completa (EM_TRIAGEM)."
      );
    }

    this.statusRastreamento = novoStatus;
  }

  public atualizarEstadoFisico(novoEstado: EstadoFisico, justificativa?: string): void {
    const quedaDeCategoria = ORDEM_ESTADO_FISICO[novoEstado] - ORDEM_ESTADO_FISICO[this.estadoFisico];

    if (quedaDeCategoria >= QUEDA_MINIMA_QUE_EXIGE_JUSTIFICATIVA) {
      if (!justificativa || justificativa.trim().length === 0) {
        throw new Error(
          `Justificativa obrigatória: estado físico caiu ${quedaDeCategoria} categorias (mínimo de ${QUEDA_MINIMA_QUE_EXIGE_JUSTIFICATIVA} exige justificativa).`
        );
      }
    }

    this.estadoFisico = novoEstado;
  }

  public registrarMovimentacao(destino: string, responsavel: string): void {
    const ultimoMovimento = this.historicoMovimentacao[this.historicoMovimentacao.length - 1];
    const origem = ultimoMovimento ? ultimoMovimento.destino : "RECEBIMENTO";

    const movimentacao = Movimentacao.criar({
      equipamentoId: this.id,
      origem,
      destino,
      responsavel
    });

    this.historicoMovimentacao.push(movimentacao);
  }

  public calcularDepreciacao(taxaAnual: number = TAXA_DEPRECIACAO_ANUAL_PADRAO): number {
    const idade = new Date().getFullYear() - this.anoFabricacao;
    const idadeEfetiva = Math.max(idade, 0);
    return Math.min(idadeEfetiva * taxaAnual, 1);
  }
}