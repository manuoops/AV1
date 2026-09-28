import { Lote, LotePersistido } from "../domain/entities/Lote";
import { Equipamento, EquipamentoPersistido } from "../domain/entities/Equipamento";
import { EquipamentoResumo } from "../domain/entities/Lote";
import { StatusLote } from "../domain/enums/StatusLote";
import { StatusRastreamento } from "../domain/enums/StatusRastreamento";
import { OrganizacaoPersistida } from "../domain/entities/Organizacao";
import { RepositorioArquivo } from "../infra/RepositorioArquivo";
import { JournalTransacao } from "../infra/JournalTransacao";

const ARQUIVO_LOTES = "lotes.json";
const ARQUIVO_EQUIPAMENTOS = "equipamentos.json";
const ARQUIVO_ORGANIZACOES = "organizacoes.json";

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

export class ServicoLote {
  private readonly repositorio: RepositorioArquivo;

  constructor(repositorio: RepositorioArquivo) {
    this.repositorio = repositorio;
  }

  public criarLote(
    dados: {
      dataEntrada: Date;
      organizacaoId: string;
      notaFiscal: string;
      transportadora: string;
      observacoes?: string;
    },
    usuarioResponsavel: string
  ): Lote {
    const organizacaoExiste = this.repositorio.carregarEntidade<OrganizacaoPersistida>(
      ARQUIVO_ORGANIZACOES,
      dados.organizacaoId
    );
    if (!organizacaoExiste) {
      throw new Error(`Organização '${dados.organizacaoId}' não encontrada.`);
    }

    const lote = Lote.criar(dados);

    const transacao = new JournalTransacao({
      operacao: "CRIAR_LOTE",
      entidade: "Lote",
      dadosAntes: null,
      dadosDepois: { id: lote.id, organizacaoId: lote.organizacaoId, notaFiscal: lote.notaFiscal },
      usuarioResponsavel
    });
    transacao.registrar();

    this.repositorio.salvarEntidade(ARQUIVO_LOTES, lote);
    return lote;
  }

  public buscarLote(id: string): Lote | null {
    const dados = this.repositorio.carregarEntidade<LotePersistido>(ARQUIVO_LOTES, id);
    return dados ? new Lote(dados) : null;
  }

  public adicionarEquipamentoToLote(loteId: string, equipamento: EquipamentoResumo, usuarioResponsavel: string): void {
    const dadosLote = this.repositorio.carregarEntidade<LotePersistido>(ARQUIVO_LOTES, loteId);
    if (!dadosLote) {
      throw new Error(`Lote '${loteId}' não encontrado.`);
    }

    const lote = new Lote(dadosLote);
    if (lote.statusProcessamento === StatusLote.FINALIZADO) {
      throw new Error("Não é possível adicionar equipamento em um lote já finalizado.");
    }

    lote.adicionarEquipamento(equipamento);

    const transacao = new JournalTransacao({
      operacao: "ADICIONAR_EQUIPAMENTO_AO_LOTE",
      entidade: "Lote",
      dadosAntes: { id: lote.id, totalEquipamentos: dadosLote.equipamentoIds.length },
      dadosDepois: { id: lote.id, totalEquipamentos: lote.listarEquipamentoIds().length },
      usuarioResponsavel
    });
    transacao.registrar();

    this.repositorio.salvarEntidade(ARQUIVO_LOTES, lote);
  }

  public processarTriagem(loteId: string, usuarioResponsavel: string): void {
    const dadosLote = this.repositorio.carregarEntidade<LotePersistido>(ARQUIVO_LOTES, loteId);
    if (!dadosLote) {
      throw new Error(`Lote '${loteId}' não encontrado.`);
    }

    const lote = new Lote(dadosLote);
    const equipamentosDoLote = this.repositorio
      .listarEntidades<EquipamentoPersistido>(ARQUIVO_EQUIPAMENTOS)
      .filter((e) => e.loteId === loteId)
      .map((e) => new Equipamento(e));

    const statusAnterior = lote.statusProcessamento;

    if (lote.statusProcessamento === StatusLote.RECEBIDO) {
      if (equipamentosDoLote.length === 0) {
        throw new Error("Lote não possui equipamentos cadastrados; não é possível iniciar a triagem.");
      }

      for (const equipamento of equipamentosDoLote) {
        equipamento.atualizarStatus(StatusRastreamento.EM_TRIAGEM, "Início da triagem do lote.");
        this.repositorio.salvarEntidade(ARQUIVO_EQUIPAMENTOS, equipamento);
      }

      lote.statusProcessamento = StatusLote.EM_TRIAGEM;
    } else if (lote.statusProcessamento === StatusLote.EM_TRIAGEM) {
      const algumAindaNaoTriado = equipamentosDoLote.some(
        (e) => ORDEM_STATUS_RASTREAMENTO[e.statusRastreamento] <= ORDEM_STATUS_RASTREAMENTO[StatusRastreamento.EM_TRIAGEM]
      );
      if (algumAindaNaoTriado) {
        throw new Error("Ainda há equipamentos aguardando triagem individual neste lote.");
      }

      lote.statusProcessamento = StatusLote.TRIAGEM_CONCLUIDA;
    } else {
      throw new Error(`Lote já está em status '${lote.statusProcessamento}', que não avança mais via processarTriagem.`);
    }

    const transacao = new JournalTransacao({
      operacao: "PROCESSAR_TRIAGEM",
      entidade: "Lote",
      dadosAntes: { id: lote.id, statusProcessamento: statusAnterior },
      dadosDepois: { id: lote.id, statusProcessamento: lote.statusProcessamento },
      usuarioResponsavel
    });
    transacao.registrar();

    this.repositorio.salvarEntidade(ARQUIVO_LOTES, lote);
  }

  public consultarLotePorPeriodo(dataInicio: Date, dataFim: Date): Lote[] {
    if (dataInicio.getTime() > dataFim.getTime()) {
      throw new Error("dataInicio não pode ser posterior a dataFim.");
    }

    return this.repositorio
      .listarEntidades<LotePersistido>(ARQUIVO_LOTES)
      .map((dados) => new Lote(dados))
      .filter((lote) => {
        const tempo = lote.dataEntrada.getTime();
        return tempo >= dataInicio.getTime() && tempo <= dataFim.getTime();
      });
  }
}