# Hospital PRJT — MVP de Gestão Hospitalar

Implementação do MVP baseada na **Especificação Revisada v2.0**. O sistema substitui a planilha como fonte operacional: a interface web recebe os inputs mínimos, o backend centraliza as regras e o PostgreSQL é a fonte de verdade. Grid, Dashboard e Modo TV são outputs derivados.

## Entregue

- Autenticação JWT e perfis/permissões granulares
- Pacientes: cadastro, busca e histórico
- Leitos: grid, estados LIVRE/OCUPADO derivados e bloqueios administrativos
- Internações: criação e alta em transações atômicas, validação de duplicidade, disponibilidade, isolamento, datas e LOS
- Dashboard calculado + ocupação dos últimos 7 dias
- Modo TV protegido por senha e sem dados clínicos
- Prontuário eletrônico com autoria e restrição de edição
- Profissionais e escala com unicidade por profissional/data/turno
- Usuários administrativos
- Excel: validação prévia, importação controlada e exportação
- Backup PostgreSQL automático a cada 6h, manual, download, restore e upload S3 opcional
- Dockerfiles e Docker Compose
- Seed inicial e testes unitários do núcleo utilitário

## Pré-requisitos

- Docker + Docker Compose (recomendado)
- Ou Node.js 20+ e PostgreSQL 15+

## Execução recomendada com Docker

1. Copie `backend/.env.example` para `backend/.env`.
2. Troque `JWT_SECRET`, `TV_PASSWORD` e as credenciais de produção.
3. Execute:

```bash
docker compose up --build
```

Acessos:

- Interface: `http://localhost:8080`
- API: `http://localhost:3001`
- Health check: `http://localhost:3001/health`

Seed de desenvolvimento:

- usuário: `admin`
- senha: `Admin123!`

**Troque a senha imediatamente em ambiente real.**

## Execução sem Docker

### Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
node prisma/seed.js
npm start
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Permissões

`ADMIN` ignora a matriz granular. Usuários comuns recebem permissões JSON por módulo e ação (`read`, `write`, `delete`). Os módulos são: `pacientes`, `leitos`, `internacoes`, `prontuario`, `profissionais`, `escala`, `dashboard`.

## Fluxo principal para validação

1. Cadastrar ou localizar paciente.
2. Abrir **Nova internação**.
3. Selecionar o paciente e um leito livre.
4. Confirmar. O leito passa a `OCUPADO` automaticamente.
5. Dashboard, Grid e TV refletem o novo estado.
6. Em **Internações**, selecionar **Dar alta**.
7. Confirmar. A internação é finalizada e o leito volta a `LIVRE` ou ao bloqueio administrativo ativo.

## Planilha

A importação espera, no mínimo:

### Aba `Pacientes`

`prontuario`, `nome`, `cpf`, `data_nascimento`, `sexo`, `nome_acompanhante`, `telefone`, `diagnostico`, `precaucoes`

### Aba `Leitos`

`numero`, `andar`, `tipo`, `observacoes`

Use **Validar** antes de **Importar**. A operação diária não depende de Excel.

## Backups

- Cron: `00:00`, `06:00`, `12:00`, `18:00`
- Local: `.sql.gz`
- Retenção local: 7 dias por padrão
- Nuvem: S3/S3-compatible opcional pelas variáveis `S3_*`
- Retenção em nuvem: 30 dias por padrão

O container do backend inclui `pg_dump`/`psql`.

## Observação de escopo

A documentação revisada menciona transferência de paciente como alternativa antes de bloquear um leito, mas **não especifica a transação, histórico ou modelo de transferência**. Para não inventar semântica clínica/operacional, esta entrega exige finalizar a internação antes de bloquear o leito ocupado. Uma futura transferência de leito deve ser especificada como transação própria, preservando histórico de movimentação.

## Bateria mínima de testes de validação

- Login, expiração e bloqueio de usuário inativo
- Cadastro e duplicidade de prontuário/CPF
- Internação normal e em isolamento
- Tentativa de dupla internação do mesmo paciente
- Tentativa de internação em leito não livre
- Alta e liberação automática do leito
- Bloqueio/manutenção/reserva e liberação
- Coerência simultânea entre Grid, Dashboard e TV
- Permissões por perfil
- Autoria de evoluções no prontuário
- Regra de escala corrigida
- Preview/importação de Excel e exportação
- Backup manual, automático, download e restore

