import { Organizacao, OrganizacaoPersistida } from "../domain/entities/Organizacao";
import { Contrato, ContratoPersistido } from "../domain/entities/Contrato";
import { Lote, LotePersistido } from "../domain/entities/Lote";
import { Equipamento, EquipamentoPersistido } from "../domain/entities/Equipamento";
import { StatusRastreamento } from "../domain/enums/StatusRastreamento";
import { RepositorioArquivo } from "../infra/RepositorioArquivo";

const ARQUIVO_ORGANIZACOES = "organizacoes.json";
const ARQUIVO_CONTRATOS = "contratos.json";
const ARQUIVO_LOTES = "lotes.json";
const ARQUIVO_EQUIPAMENTOS = "equipamentos.json";

export interface Periodo {
  inicio: Date;
  fim: Date;
}

export class ServicoRelatorio {
  private readonly repositorio: RepositorioArquivo;

  constructor(repositorio: RepositorioArquivo) {
    this.repositorio = repositorio;
  }

  public gerarRelatorioPorOrganizacao(organizacaoId: string, periodo: Periodo): string {
    this.validarPeriodo(periodo);

    const dadosOrganizacao = this.repositorio.carregarEntidade<OrganizacaoPersistida>(
      ARQUIVO_ORGANIZACOES,
      organizacaoId
    );
    if (!dadosOrganizacao) {
      throw new Error(`Organização '${organizacaoId}' não encontrada.`);
    }
    const organizacao = new Organizacao(dadosOrganizacao);

    const lotes = this.repositorio
      .listarEntidades<LotePersistido>(ARQUIVO_LOTES)
      .map((dados) => new Lote(dados))
      .filter(
        (lote) =>
          lote.organizacaoId === organizacaoId &&
          lote.dataEntrada.getTime() >= periodo.inicio.getTime() &&
          lote.dataEntrada.getTime() <= periodo.fim.getTime()
      );

    const todosEquipamentos = this.repositorio.listarEntidades<EquipamentoPersistido>(ARQUIVO_EQUIPAMENTOS);

    const linhas = [
      `=== Relatório por Organização ===`,
      `Organização: ${organizacao.razaoSocial} (CNPJ: ${organizacao.cnpj})`,
      `Período: ${this.formatarData(periodo.inicio)} a ${this.formatarData(periodo.fim)}`,
      `Lotes no período: ${lotes.length}`,
      ""
    ];

    let pesoTotalGeral = 0;
    for (const lote of lotes) {
      const equipamentosDoLote = todosEquipamentos.filter((e) => e.loteId === lote.id);
      const pesoLote = equipamentosDoLote.reduce((soma, e) => soma + e.pesoQuilogramas, 0);
      pesoTotalGeral += pesoLote;

      linhas.push(
        `- Lote ${lote.id} | NF ${lote.notaFiscal} | ${this.formatarData(lote.dataEntrada)} | ` +
          `Status: ${lote.statusProcessamento} | Equipamentos: ${equipamentosDoLote.length} | Peso: ${pesoLote} kg`
      );
    }

    linhas.push("");
    linhas.push(`Peso total no período: ${pesoTotalGeral} kg`);

    return linhas.join("\n");
  }

  public gerarRelatorioPorStatus(status: StatusRastreamento): string {
    const equipamentos = this.repositorio
      .listarEntidades<EquipamentoPersistido>(ARQUIVO_EQUIPAMENTOS)
      .map((dados) => new Equipamento(dados))
      .filter((equip) => equip.statusRastreamento === status);

    const pesoTotal = equipamentos.reduce((soma, e) => soma + e.pesoQuilogramas, 0);

    const linhas = [
      `=== Relatório por Status de Rastreamento ===`,
      `Status: ${status}`,
      `Total de equipamentos: ${equipamentos.length}`,
      `Peso total: ${pesoTotal} kg`,
      ""
    ];

    for (const equip of equipamentos) {
      linhas.push(
        `- ${equip.codigoBarrasInterno} | ${equip.tipo} | ${equip.marca} ${equip.modelo} | ` +
          `Lote: ${equip.loteId} | Estado físico: ${equip.estadoFisico} | Peso: ${equip.pesoQuilogramas} kg`
      );
    }

    return linhas.join("\n");
  }

  public gerarRelatorioFinanceiro(periodo: Periodo): string {
    this.validarPeriodo(periodo);

    const contratos = this.repositorio
      .listarEntidades<ContratoPersistido>(ARQUIVO_CONTRATOS)
      .map((dados) => new Contrato(dados))
      .filter(
        (contrato) =>
          contrato.dataAssinatura.getTime() >= periodo.inicio.getTime() &&
          contrato.dataAssinatura.getTime() <= periodo.fim.getTime()
      );

    const organizacoes = this.repositorio.listarEntidades<OrganizacaoPersistida>(ARQUIVO_ORGANIZACOES);

    const linhas = [
      `=== Relatório Financeiro (receita de contratos) ===`,
      `Período: ${this.formatarData(periodo.inicio)} a ${this.formatarData(periodo.fim)}`,
      `Contratos assinados no período: ${contratos.length}`,
      ""
    ];

    let receitaTotal = 0;
    for (const contrato of contratos) {
      const organizacao = organizacoes.find((o) => o.id === contrato.organizacaoId);
      receitaTotal += contrato.valorMensal;

      linhas.push(
        `- Contrato ${contrato.id} | Organização: ${organizacao?.razaoSocial ?? "(desconhecida)"} | ` +
          `Assinado em: ${this.formatarData(contrato.dataAssinatura)} | Valor mensal: R$ ${contrato.valorMensal.toFixed(2)}`
      );
    }

    linhas.push("");
    linhas.push(`Receita mensal total (soma dos contratos do período): R$ ${receitaTotal.toFixed(2)}`);

    return linhas.join("\n");
  }

  private validarPeriodo(periodo: Periodo): void {
    if (periodo.inicio.getTime() > periodo.fim.getTime()) {
      throw new Error("periodo.inicio não pode ser posterior a periodo.fim.");
    }
  }

  private formatarData(data: Date): string {
    return data.toISOString().slice(0, 10);
  }
}