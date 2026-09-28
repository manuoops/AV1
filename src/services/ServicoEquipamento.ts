import { Equipamento, EquipamentoPersistido } from "../domain/entities/Equipamento";
import { Movimentacao } from "../domain/entities/Movimentacao";
import { Lote, LotePersistido } from "../domain/entities/Lote";
import { Organizacao, OrganizacaoPersistida } from "../domain/entities/Organizacao";
import { TipoEquipamento } from "../domain/enums/TipoEquipamento";
import { EstadoFisico } from "../domain/enums/EstadoFisico";
import { StatusRastreamento } from "../domain/enums/StatusRastreamento";
import { RepositorioArquivo } from "../infra/RepositorioArquivo";
import { JournalTransacao } from "../infra/JournalTransacao";

const ARQUIVO_EQUIPAMENTOS = "equipamentos.json";
const ARQUIVO_LOTES = "lotes.json";
const ARQUIVO_ORGANIZACOES = "organizacoes.json";

const PREFIXO_POR_TIPO: Record<TipoEquipamento, string> = {
  [TipoEquipamento.COMPUTADOR_MESA]: "CPD",
  [TipoEquipamento.NOTEBOOK]: "NTB",
  [TipoEquipamento.MONITOR]: "MON",
  [TipoEquipamento.IMPRESSORA]: "IMP",
  [TipoEquipamento.SERVIDOR]: "SRV",
  [TipoEquipamento.ROTEADOR]: "RTD",
  [TipoEquipamento.CABO_ESTRUTURADO]: "CAB",
  [TipoEquipamento.FONTE_ALIMENTACAO]: "FNT"
};

export interface HistoricoCompleto {
  equipamento: Equipamento;
  lote: Lote | null;
  organizacao: Organizacao | null;
  movimentacoes: Movimentacao[];
}

export class ServicoEquipamento {
  private readonly repositorio: RepositorioArquivo;

  constructor(repositorio: RepositorioArquivo) {
    this.repositorio = repositorio;
  }

  public gerarCodigoBarras(tipo: TipoEquipamento, sequencia: number): string {
    if (!Number.isInteger(sequencia) || sequencia < 1) {
      throw new Error("sequencia deve ser um número inteiro positivo.");
    }
    const prefixo = PREFIXO_POR_TIPO[tipo];
    return `${prefixo}-${sequencia.toString().padStart(6, "0")}`;
  }

  public cadastrarEquipamento(
    dados: {
      tipo: TipoEquipamento;
      marca: string;
      modelo: string;
      anoFabricacao: number;
      estadoFisico: EstadoFisico;
      pesoQuilogramas: number;
      loteId: string;
    },
    usuarioResponsavel: string
  ): Equipamento {
    const dadosLote = this.repositorio.carregarEntidade<LotePersistido>(ARQUIVO_LOTES, dados.loteId);
    if (!dadosLote) {
      throw new Error(`Lote '${dados.loteId}' não encontrado.`);
    }

    const todosEquipamentos = this.repositorio.listarEntidades<EquipamentoPersistido>(ARQUIVO_EQUIPAMENTOS);
    const sequenciaDoTipo = todosEquipamentos.filter((e) => e.tipo === dados.tipo).length + 1;
    const codigoBarrasInterno = this.gerarCodigoBarras(dados.tipo, sequenciaDoTipo);
    const posicaoNoLote = todosEquipamentos.filter((e) => e.loteId === dados.loteId).length + 1;

    const equipamento = Equipamento.criar({ ...dados, codigoBarrasInterno, posicaoNoLote });

    const transacao = new JournalTransacao({
      operacao: "CADASTRAR_EQUIPAMENTO",
      entidade: "Equipamento",
      dadosAntes: null,
      dadosDepois: { id: equipamento.id, codigoBarrasInterno, loteId: dados.loteId },
      usuarioResponsavel
    });
    transacao.registrar();

    this.repositorio.salvarEntidade(ARQUIVO_EQUIPAMENTOS, equipamento);

    const lote = new Lote(dadosLote);
    lote.adicionarEquipamento(equipamento);
    this.repositorio.salvarEntidade(ARQUIVO_LOTES, lote);

    return equipamento;
  }

  public buscarEquipamento(id: string): Equipamento | null {
    const dados = this.repositorio.carregarEntidade<EquipamentoPersistido>(ARQUIVO_EQUIPAMENTOS, id);
    return dados ? new Equipamento(dados) : null;
  }

  public rastrearEquipamento(id: string): HistoricoCompleto {
    const dadosEquipamento = this.repositorio.carregarEntidade<EquipamentoPersistido>(ARQUIVO_EQUIPAMENTOS, id);
    if (!dadosEquipamento) {
      throw new Error(`Equipamento '${id}' não encontrado.`);
    }

    const equipamento = new Equipamento(dadosEquipamento);

    const dadosLote = this.repositorio.carregarEntidade<LotePersistido>(ARQUIVO_LOTES, equipamento.loteId);
    const lote = dadosLote ? new Lote(dadosLote) : null;

    let organizacao: Organizacao | null = null;
    if (lote) {
      const dadosOrganizacao = this.repositorio.carregarEntidade<OrganizacaoPersistida>(
        ARQUIVO_ORGANIZACOES,
        lote.organizacaoId
      );
      organizacao = dadosOrganizacao ? new Organizacao(dadosOrganizacao) : null;
    }

    return {
      equipamento,
      lote,
      organizacao,
      movimentacoes: equipamento.listarHistoricoMovimentacao()
    };
  }

  public atualizarEstadoFisico(
    id: string,
    novoEstado: EstadoFisico,
    usuarioResponsavel: string,
    justificativa?: string
  ): void {
    const dados = this.repositorio.carregarEntidade<EquipamentoPersistido>(ARQUIVO_EQUIPAMENTOS, id);
    if (!dados) {
      throw new Error(`Equipamento '${id}' não encontrado.`);
    }

    const equipamento = new Equipamento(dados);
    const estadoAnterior = equipamento.estadoFisico;
    equipamento.atualizarEstadoFisico(novoEstado, justificativa);

    const transacao = new JournalTransacao({
      operacao: "ATUALIZAR_ESTADO_FISICO",
      entidade: "Equipamento",
      dadosAntes: { id, estadoFisico: estadoAnterior },
      dadosDepois: { id, estadoFisico: novoEstado, justificativa: justificativa ?? null },
      usuarioResponsavel
    });
    transacao.registrar();

    this.repositorio.salvarEntidade(ARQUIVO_EQUIPAMENTOS, equipamento);
  }

  public atualizarStatusRastreamento(
    id: string,
    novoStatus: StatusRastreamento,
    justificativa: string,
    usuarioResponsavel: string
  ): void {
    const dados = this.repositorio.carregarEntidade<EquipamentoPersistido>(ARQUIVO_EQUIPAMENTOS, id);
    if (!dados) {
      throw new Error(`Equipamento '${id}' não encontrado.`);
    }

    const equipamento = new Equipamento(dados);
    const statusAnterior = equipamento.statusRastreamento;
    equipamento.atualizarStatus(novoStatus, justificativa);

    const transacao = new JournalTransacao({
      operacao: "ATUALIZAR_STATUS_RASTREAMENTO",
      entidade: "Equipamento",
      dadosAntes: { id, statusRastreamento: statusAnterior },
      dadosDepois: { id, statusRastreamento: novoStatus, justificativa },
      usuarioResponsavel
    });
    transacao.registrar();

    this.repositorio.salvarEntidade(ARQUIVO_EQUIPAMENTOS, equipamento);
  }

  public registrarMovimentacao(
    id: string,
    destino: string,
    responsavel: string,
    usuarioResponsavel: string
  ): void {
    const dados = this.repositorio.carregarEntidade<EquipamentoPersistido>(ARQUIVO_EQUIPAMENTOS, id);
    if (!dados) {
      throw new Error(`Equipamento '${id}' não encontrado.`);
    }

    const equipamento = new Equipamento(dados);
    equipamento.registrarMovimentacao(destino, responsavel);

    const transacao = new JournalTransacao({
      operacao: "REGISTRAR_MOVIMENTACAO",
      entidade: "Equipamento",
      dadosAntes: null,
      dadosDepois: { id, destino, responsavel },
      usuarioResponsavel
    });
    transacao.registrar();

    this.repositorio.salvarEntidade(ARQUIVO_EQUIPAMENTOS, equipamento);
  }
}