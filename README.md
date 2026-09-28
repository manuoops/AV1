# AV1 - Greencode

# greencode

CLI de gestão de logística reversa de equipamentos eletrônicos: cadastro de
organizações e contratos, recebimento de lotes, triagem e rastreabilidade de
equipamentos até o descarte/reciclagem final.

## Requisitos

- Node.js 18 ou superior

## Instalação

```bash
npm install
```

## Como rodar

```bash
npm run dev
```

Na primeira execução, o sistema pede pra você definir a senha do
administrador inicial (usuário `admin`). Depois disso, use `usuario login`
pra entrar.

## Comandos básicos dentro do CLI

```
ajuda                    # lista os comandos disponíveis pro seu papel
usuario login --usuario admin --senha <senha>
organizacao cadastrar --razaoSocial "..." --cnpj ... --inscricaoEstadual ... --endereco ... --telefone ... --email ...
lote criar --org <id> --nf <nota-fiscal> --transp <transportadora>
equipamento cadastrar --lote <id> --tipo ... --marca ... --modelo ... --ano ... --estado ... --peso ...
sair                     # encerra o programa
```

## Testes

```bash
npm test              # testes unitários
npm run test:journey  # simula uma jornada completa de usuário, do zero até o fim
```

## Papéis de usuário

| Papel | Pode fazer |
|---|---|
| `ADMINISTRADOR` | Tudo, incluindo gerenciar contas |
| `OPERADOR_CADASTRO` | Cadastrar organizações e contratos |
| `GESTOR_ALMOXARIFADO` | Gerenciar lotes e equipamentos |
| `AUDITORIA` | Só consultar e gerar relatórios |

## Documentação

Detalhes de arquitetura e segurança estão em `documentacao-seguranca.pdf`.
