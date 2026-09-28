import { Organizacao, OrganizacaoPersistida } from "../domain/entities/Organizacao";
import { Contrato, ContratoPersistido } from "../domain/entities/Contrato";
import { ValidadorCNPJ } from "../validators/ValidadorCNPJ";
import { RepositorioArquivo } from "../infra/RepositorioArquivo";
import { JournalTransacao } from "../infra/JournalTransacao";

const ARQUIVO_ORGANIZACOES = "organizacoes.json";
const ARQUIVO_CONTRATOS = "contratos.json";

export class ServicoOrganizacao {
  private readonly repositorio: RepositorioArquivo;
  private readonly validadorCNPJ: ValidadorCNPJ;

  constructor(repositorio: RepositorioArquivo) {
    this.repositorio = repositorio;
    this.validadorCNPJ = new ValidadorCNPJ();
  }

  public cadastrarOrganizacao(
    dados: {
      razaoSocial: string;
      cnpj: string;
      inscricaoEstadual: string;
      enderecoCompleto: string;
      telefone: string;
      email: string;
    },
    usuarioResponsavel: string
  ): Organizacao {
    if (!this.validadorCNPJ.validar(dados.cnpj)) {
      throw new Error(this.validadorCNPJ.obterMensagemErro());
    }

    if (this.existeOrganizacaoComCnpj(dados.cnpj)) {
      throw new Error("Já existe uma organização cadastrada com este CNPJ.");
    }

    const organizacao = Organizacao.criar(dados);

    const transacao = new JournalTransacao({
      operacao: "CADASTRAR_ORGANIZACAO",
      entidade: "Organizacao",
      dadosAntes: null,
      dadosDepois: { id: organizacao.id, razaoSocial: organizacao.razaoSocial, cnpj: organizacao.cnpj },
      usuarioResponsavel
    });
    transacao.registrar();

    this.repositorio.salvarEntidade(ARQUIVO_ORGANIZACOES, organizacao);
    return organizacao;
  }

  public buscarOrganizacao(id: string): Organizacao | null {
    const dados = this.repositorio.carregarEntidade<OrganizacaoPersistida>(ARQUIVO_ORGANIZACOES, id);
    if (!dados) {
      return null;
    }

    const organizacao = new Organizacao(dados);
    organizacao.contratoVigente = this.buscarContratoVigente(id);
    return organizacao;
  }

  public listarOrganizacoesAtivas(): Organizacao[] {
    return this.repositorio
      .listarEntidades<OrganizacaoPersistida>(ARQUIVO_ORGANIZACOES)
      .filter((dados) => dados.ativo)
      .map((dados) => new Organizacao(dados));
  }

  public cadastrarContrato(
    dados: {
      organizacaoId: string;
      dataVencimento: Date;
      clausulas: string[];
      valorMensal: number;
      renovacaoAutomatica: boolean;
    },
    usuarioResponsavel: string
  ): Contrato {
    const organizacaoExiste = this.repositorio.carregarEntidade<OrganizacaoPersistida>(
      ARQUIVO_ORGANIZACOES,
      dados.organizacaoId
    );
    if (!organizacaoExiste) {
      throw new Error(`Organização '${dados.organizacaoId}' não encontrada.`);
    }

    const contrato = Contrato.criar(dados);

    const transacao = new JournalTransacao({
      operacao: "CADASTRAR_CONTRATO",
      entidade: "Contrato",
      dadosAntes: null,
      dadosDepois: { id: contrato.id, organizacaoId: contrato.organizacaoId, valorMensal: contrato.valorMensal },
      usuarioResponsavel
    });
    transacao.registrar();

    this.repositorio.salvarEntidade(ARQUIVO_CONTRATOS, contrato);
    return contrato;
  }

  public renovarContrato(organizacaoId: string, novoVencimento: Date, usuarioResponsavel: string): void {
    const contrato = this.buscarContratoVigente(organizacaoId);
    if (!contrato) {
      throw new Error(`Nenhum contrato vigente encontrado para a organização '${organizacaoId}'.`);
    }

    const vencimentoAnterior = contrato.dataVencimento;
    contrato.renovar(novoVencimento);

    const transacao = new JournalTransacao({
      operacao: "RENOVAR_CONTRATO",
      entidade: "Contrato",
      dadosAntes: { id: contrato.id, dataVencimento: vencimentoAnterior },
      dadosDepois: { id: contrato.id, dataVencimento: contrato.dataVencimento },
      usuarioResponsavel
    });
    transacao.registrar();

    this.repositorio.salvarEntidade(ARQUIVO_CONTRATOS, contrato);
  }

  private existeOrganizacaoComCnpj(cnpj: string): boolean {
    const cnpjLimpo = cnpj.replace(/\D/g, "");
    return this.repositorio
      .listarEntidades<OrganizacaoPersistida>(ARQUIVO_ORGANIZACOES)
      .some((org) => org.cnpj.replace(/\D/g, "") === cnpjLimpo);
  }

  private buscarContratoVigente(organizacaoId: string): Contrato | null {
    const vigentes = this.repositorio
      .listarEntidades<ContratoPersistido>(ARQUIVO_CONTRATOS)
      .filter((dados) => dados.organizacaoId === organizacaoId)
      .map((dados) => new Contrato(dados))
      .filter((contrato) => contrato.estaVigente());

    if (vigentes.length === 0) {
      return null;
    }

    vigentes.sort((a, b) => b.dataVencimento.getTime() - a.dataVencimento.getTime());
    return vigentes[0] as Contrato;
  }
}