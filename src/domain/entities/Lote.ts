import * as crypto from "crypto";
import { StatusLote } from "../enums/StatusLote";
import { ValidadorDataEntrada } from "../../validators/ValidadorDataEntrada"

const DIAS_MAXIMOS_RETROATIVOS = 90;

export interface LotePersistido {
  id: string;
  dataEntrada: string | Date;
  organizacaoId: string;
  notaFiscal: string;
  transportadora: string;
  equipamentoIds: string[];
  statusProcessamento: StatusLote;
  observacoes: string;
}

export interface EquipamentoResumo {
  id: string;
  pesoQuilogramas: number;
}

export class Lote {
  public readonly id: string;
  public readonly dataEntrada: Date;
  public readonly organizacaoId: string;
  public notaFiscal: string;
  public transportadora: string;
  private equipamentoIds: string[];
  public statusProcessamento: StatusLote;
  public observacoes: string;

  constructor(dados: LotePersistido) {
    this.id = dados.id;
    this.dataEntrada = new Date(dados.dataEntrada);
    this.organizacaoId = dados.organizacaoId;
    this.notaFiscal = dados.notaFiscal;
    this.transportadora = dados.transportadora;
    this.equipamentoIds = [...dados.equipamentoIds];
    this.statusProcessamento = dados.statusProcessamento;
    this.observacoes = dados.observacoes;
  }

  public static criar(dados: {
    dataEntrada: Date;
    organizacaoId: string;
    notaFiscal: string;
    transportadora: string;
    observacoes?: string;
  }): Lote {
    if (!dados.organizacaoId || dados.organizacaoId.trim().length === 0) {
      throw new Error("organizacaoId é obrigatório.");
    }
    if (!dados.notaFiscal || dados.notaFiscal.trim().length === 0) {
      throw new Error("notaFiscal é obrigatória.");
    }
    if (!dados.transportadora || dados.transportadora.trim().length === 0) {
      throw new Error("transportadora é obrigatória.");
    }
    Lote.validarDataEntrada(dados.dataEntrada);

    return new Lote({
      id: crypto.randomUUID(),
      dataEntrada: dados.dataEntrada,
      organizacaoId: dados.organizacaoId,
      notaFiscal: dados.notaFiscal,
      transportadora: dados.transportadora,
      equipamentoIds: [],
      statusProcessamento: StatusLote.RECEBIDO,
      observacoes: dados.observacoes ?? ""
    });
  }

  private static validarDataEntrada(dataEntrada: Date): void {
    const validador = new ValidadorDataEntrada();
    if (!validador.validar(dataEntrada)) {
      throw new Error(validador.obterMensagemErro());
    }
  }

  public listarEquipamentoIds(): string[] {
    return [...this.equipamentoIds];
  }

  public adicionarEquipamento(equip: EquipamentoResumo): void {
    if (!this.equipamentoIds.includes(equip.id)) {
      this.equipamentoIds.push(equip.id);
    }
  }

  public removerEquipamento(equipamentoId: string): boolean {
    const tamanhoAntes = this.equipamentoIds.length;
    this.equipamentoIds = this.equipamentoIds.filter((id) => id !== equipamentoId);
    return this.equipamentoIds.length < tamanhoAntes;
  }

  public calcularPesoTotal(equipamentosDoLote: EquipamentoResumo[]): number {
    return equipamentosDoLote
      .filter((equip) => this.equipamentoIds.includes(equip.id))
      .reduce((soma, equip) => soma + equip.pesoQuilogramas, 0);
  }

  public gerarRelatorioTriagem(): string {
    const linhas = [
      `Lote: ${this.id}`,
      `Nota Fiscal: ${this.notaFiscal}`,
      `Transportadora: ${this.transportadora}`,
      `Data de entrada: ${this.dataEntrada.toISOString().slice(0, 10)}`,
      `Status: ${this.statusProcessamento}`,
      `Quantidade de equipamentos: ${this.equipamentoIds.length}`,
      `Observações: ${this.observacoes || "(nenhuma)"}`
    ];
    return linhas.join("\n");
  }
}