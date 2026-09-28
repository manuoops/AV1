import * as fs from "fs";
import * as path from "path";
import { ClienteCLI, extrairGrupo } from "./utils/ClienteCLI";

const DIRETORIO_DADOS_TESTE = path.join(__dirname, "tmp-dados-jornada-completa");

const SENHA_ADMIN = "SenhaForte#2026";
const CNPJ_VALIDO = "11.222.333/0001-81";

jest.setTimeout(120_000);

describe("greencode — jornada completa de usuário", () => {
  let cli: ClienteCLI;

  beforeAll(() => {
    if (fs.existsSync(DIRETORIO_DADOS_TESTE)) {
      fs.rmSync(DIRETORIO_DADOS_TESTE, { recursive: true, force: true });
    }
    cli = new ClienteCLI(DIRETORIO_DADOS_TESTE);
  });

  afterAll(() => {
    cli.encerrar();
  });

  test("1. provisionamento inicial cria o administrador e gera a chave mestre", async () => {
    await cli.aguardar(/Defina a senha do administrador inicial: $/);

    const saida = await cli.comando(SENHA_ADMIN);

    expect(saida).toMatch(/Administrador 'admin' criado com sucesso/);
    expect(fs.existsSync(path.join(DIRETORIO_DADOS_TESTE, "config.master.json"))).toBe(true);
  });

  test("2. login com senha errada é rejeitado, e com senha certa funciona", async () => {
    const tentativaErrada = await cli.comando("usuario login --usuario admin --senha senhaErrada123");
    expect(tentativaErrada).toMatch(/\[ERRO\]/);

    const loginCerto = await cli.comando(`usuario login --usuario admin --senha ${SENHA_ADMIN}`);
    expect(loginCerto).toMatch(/\[SUCESSO\]/);
    expect(loginCerto).toMatch(/Login bem-sucedido/);
  });

  let organizacaoId: string;

  test("3. cadastra organização com CNPJ válido", async () => {
    const saida = await cli.comando(
      `organizacao cadastrar --razaoSocial "Escola Tecnica Municipal" --cnpj "${CNPJ_VALIDO}" ` +
        `--inscricaoEstadual "ISENTO" --endereco "Rua das Flores, 100" --telefone "12988887777" --email "contato@escola.example"`
    );

    expect(saida).toMatch(/\[SUCESSO\]/);
    organizacaoId = extrairGrupo(saida, /Organização cadastrada:\s*(\S+)/, "id da organização");
    expect(organizacaoId.length).toBeGreaterThan(0);
  });

  test("3b. cadastro de organização com CNPJ inválido é rejeitado (se o validador estiver plugado)", async () => {
    const saida = await cli.comando(
      `organizacao cadastrar --razaoSocial "Empresa Invalida" --cnpj "11.222.333/0001-00" ` +
        `--inscricaoEstadual "ISENTO" --endereco "Rua Teste, 1" --telefone "12900000000" --email "invalida@example.com"`
    );

    expect(saida).toMatch(/\[ERRO\]/);
  });

  test("4. cadastra contrato para a organização", async () => {
    const saida = await cli.comando(
      `contrato cadastrar --org ${organizacaoId} --vencimento 2027-12-31 --valorMensal 1500.00`
    );
    expect(saida).toMatch(/\[SUCESSO\]/);
    expect(saida).toMatch(/Contrato cadastrado/);
  });

  test("4b. lote com data de entrada futura é rejeitado (regra dos 90 dias / não-futuro)", async () => {
    const dataFutura = new Date();
    dataFutura.setDate(dataFutura.getDate() + 5);
    const dataFuturaISO = dataFutura.toISOString().slice(0, 10);

    const saida = await cli.comando(
      `lote criar --org ${organizacaoId} --nf NF-FUTURO --transp "Transportadora Teste" --dataEntrada ${dataFuturaISO}`
    );
    expect(saida).toMatch(/\[ERRO\]/);
  });

  let loteId: string;

  test("5. cria lote válido (data de hoje, dentro da janela permitida)", async () => {
    const saida = await cli.comando(
      `lote criar --org ${organizacaoId} --nf NF-000123 --transp "Transportadora Verde"`
    );
    expect(saida).toMatch(/\[SUCESSO\]/);
    loteId = extrairGrupo(saida, /Lote criado:\s*(\S+)/, "id do lote");
    expect(loteId.length).toBeGreaterThan(0);
  });

  let equipamentoId: string;

  test("6. cadastra equipamento dentro do lote", async () => {
    const saida = await cli.comando(
      `equipamento cadastrar --lote ${loteId} --tipo COMPUTADOR_MESA --marca "Dell" --modelo "OptiPlex 3080" ` +
        `--ano 2019 --estado BOM_ESTADO --peso 8.5`
    );
    expect(saida).toMatch(/\[SUCESSO\]/);
    equipamentoId = extrairGrupo(saida, /Equipamento cadastrado:\s*(\S+)/, "id do equipamento");
    expect(equipamentoId.length).toBeGreaterThan(0);
  });

  test("7. avança a triagem do lote: fase 1 (RECEBIDO -> EM_TRIAGEM)", async () => {
    const primeiraEtapa = await cli.comando(`lote processar-triagem --id ${loteId}`);
    expect(primeiraEtapa).toMatch(/\[SUCESSO\]/);
    expect(primeiraEtapa).toMatch(/EM_TRIAGEM/);
  });

  test("8. avança o status de rastreamento do equipamento até EM_DESMONTE", async () => {
    const paraEmTriagem = await cli.comando(
      `equipamento atualizar-status --id ${equipamentoId} --status EM_TRIAGEM --justificativa "Iniciando triagem individual do equipamento"`
    );
    expect(paraEmTriagem).toMatch(/\[SUCESSO\]/);

    const paraAguardandoDesmonte = await cli.comando(
      `equipamento atualizar-status --id ${equipamentoId} --status AGUARDANDO_DESMONTE --justificativa "Triagem concluída, equipamento aprovado para desmonte"`
    );
    expect(paraAguardandoDesmonte).toMatch(/\[SUCESSO\]/);

    const segundaEtapaLote = await cli.comando(`lote processar-triagem --id ${loteId}`);
    expect(segundaEtapaLote).toMatch(/\[SUCESSO\]/);
    expect(segundaEtapaLote).toMatch(/TRIAGEM_CONCLUIDA/);

    const paraEmDesmonte = await cli.comando(
      `equipamento atualizar-status --id ${equipamentoId} --status EM_DESMONTE --justificativa "Iniciando desmontagem para separação de componentes"`
    );
    expect(paraEmDesmonte).toMatch(/\[SUCESSO\]/);
  });

  test("9. alteração pequena de estado físico não exige justificativa", async () => {
    const saida = await cli.comando(`equipamento atualizar-estado --id ${equipamentoId} --estado USADO_LEVE`);
    expect(saida).toMatch(/\[SUCESSO\]/);
  });

  test("9b. queda de 2+ categorias no estado físico sem justificativa é rejeitada", async () => {
    const semJustificativa = await cli.comando(`equipamento atualizar-estado --id ${equipamentoId} --estado INSERVIVEL`);
    expect(semJustificativa).toMatch(/\[ERRO\]/);

    const comJustificativa = await cli.comando(
      `equipamento atualizar-estado --id ${equipamentoId} --estado INSERVIVEL --justificativa "Equipamento sofreu dano estrutural irreversível durante o desmonte"`
    );
    expect(comJustificativa).toMatch(/\[SUCESSO\]/);
  });

  test("10. registra múltiplas movimentações físicas do equipamento", async () => {
    const primeira = await cli.comando(
      `equipamento movimentar --id ${equipamentoId} --destino "Bancada de Triagem 1" --responsavel "Carlos Almoxarife"`
    );
    expect(primeira).toMatch(/\[SUCESSO\]/);

    const segunda = await cli.comando(
      `equipamento movimentar --id ${equipamentoId} --destino "Setor de Desmonte" --responsavel "Carlos Almoxarife"`
    );
    expect(segunda).toMatch(/\[SUCESSO\]/);

    const terceira = await cli.comando(
      `equipamento movimentar --id ${equipamentoId} --destino "Descarte Final Certificado" --responsavel "Marina Auditora"`
    );
    expect(terceira).toMatch(/\[SUCESSO\]/);
  });

  test("11. consulta a rastreabilidade completa do equipamento após múltiplas movimentações", async () => {
    const saida = await cli.comando(`equipamento rastrear --id ${equipamentoId}`);

    expect(saida).toMatch(/\[INFO\]/);
    expect(saida).toMatch(/Histórico de movimentações \(3\):/);
    expect(saida).toMatch(/Bancada de Triagem 1/);
    expect(saida).toMatch(/Setor de Desmonte/);
    expect(saida).toMatch(/Descarte Final Certificado/);
    expect(saida).toMatch(/INSERVIVEL/);
  });

  test("12. gera relatório por organização cobrindo o período do teste", async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const saida = await cli.comando(`relatorio organizacao --org ${organizacaoId} --inicio ${hoje} --fim ${hoje}`);

    expect(saida).toMatch(/\[INFO\]/);
    expect(saida).toMatch(/Relatório por Organização/);
    expect(saida).toMatch(new RegExp(loteId));
  });

  test("13. auditor não deve conseguir cadastrar organização (controle de papel)", async () => {
    const cadastro = await cli.comando(
      `usuario cadastrar --usuario auditora1 --senha "OutraSenhaForte#1" --papel AUDITORIA`
    );
    expect(cadastro).toMatch(/\[SUCESSO\]/);

    await cli.comando("usuario logout");
    await cli.comando('usuario login --usuario auditora1 --senha "OutraSenhaForte#1"');

    const tentativaProibida = await cli.comando(
      `organizacao cadastrar --razaoSocial "Nao Deveria Existir" --cnpj "${CNPJ_VALIDO}" ` +
        `--inscricaoEstadual "ISENTO" --endereco "Rua X" --telefone "129999999" --email "x@x.com"`
    );
    expect(tentativaProibida).toMatch(/\[ERRO\]/);
    expect(tentativaProibida).toMatch(/não tem permissão/);

    const consultaPermitida = await cli.comando(`equipamento rastrear --id ${equipamentoId}`);
    expect(consultaPermitida).toMatch(/\[INFO\]/);
  });

  test("14. encerra a sessão e sai do programa de forma limpa", async () => {
    await cli.comando("usuario logout");

    cli.escrever("sair");
    const saidaFinal = await cli.aguardar(/Até logo!/, 5_000);
    expect(saidaFinal).toMatch(/Até logo!/);
  });
});