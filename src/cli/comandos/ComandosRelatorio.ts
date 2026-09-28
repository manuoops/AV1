import { Despachante, Severidade, ComandoDefinido } from "../Despachante";
import { ServicoRelatorio } from "../../services/ServicoRelatorio";
import { StatusRastreamento } from "../../domain/enums/StatusRastreamento";
import { exigirFlag, analisarData, analisarEnum } from "../ComandoUtils";

export function registrarComandosRelatorio(despachante: Despachante, servicoRelatorio: ServicoRelatorio): void {
  const relatorioOrganizacao: ComandoDefinido = {
    recurso: "relatorio",
    acao: "organizacao",
    requerAutenticacao: true,
    papeisPermitidos: [],
    descricao:
      "Gera relatório de lotes/peso de uma organização em um período. Uso: relatorio organizacao --org <id> --inicio <AAAA-MM-DD> --fim <AAAA-MM-DD>",
    executar: (ctx) => {
      const organizacaoId = exigirFlag(ctx.flags, "org");
      const inicio = analisarData(exigirFlag(ctx.flags, "inicio"), "inicio");
      const fim = analisarData(exigirFlag(ctx.flags, "fim"), "fim");
      fim.setHours(23, 59, 59, 999);

      const relatorio = servicoRelatorio.gerarRelatorioPorOrganizacao(organizacaoId, { inicio, fim });

      return { severidade: Severidade.INFO, mensagem: relatorio };
    }
  };

  const relatorioStatus: ComandoDefinido = {
    recurso: "relatorio",
    acao: "status",
    requerAutenticacao: true,
    papeisPermitidos: [],
    descricao: `Gera relatório de equipamentos por status de rastreamento. Uso: relatorio status --status <${Object.values(
      StatusRastreamento
    ).join("|")}>`,
    executar: (ctx) => {
      const status = analisarEnum(
        exigirFlag(ctx.flags, "status"),
        Object.values(StatusRastreamento),
        "status"
      );

      const relatorio = servicoRelatorio.gerarRelatorioPorStatus(status);

      return { severidade: Severidade.INFO, mensagem: relatorio };
    }
  };

  const relatorioFinanceiro: ComandoDefinido = {
    recurso: "relatorio",
    acao: "financeiro",
    requerAutenticacao: true,
    papeisPermitidos: [],
    descricao:
      "Gera relatório financeiro (receita de contratos) em um período. Uso: relatorio financeiro --inicio <AAAA-MM-DD> --fim <AAAA-MM-DD>",
    executar: (ctx) => {
      const inicio = analisarData(exigirFlag(ctx.flags, "inicio"), "inicio");
      const fim = analisarData(exigirFlag(ctx.flags, "fim"), "fim");
      fim.setHours(23, 59, 59, 999);

      const relatorio = servicoRelatorio.gerarRelatorioFinanceiro({ inicio, fim });

      return { severidade: Severidade.INFO, mensagem: relatorio };
    }
  };

  despachante.registrar(relatorioOrganizacao);
  despachante.registrar(relatorioStatus);
  despachante.registrar(relatorioFinanceiro);
}