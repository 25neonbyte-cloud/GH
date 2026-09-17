# Hospital PRJT — MVP Operacional para Apresentação

MVP web baseado na **Especificação Revisada v2.0**, preparado para simular um dia real de trabalho hospitalar. O PostgreSQL é a fonte operacional; Dashboard, mapa de leitos e Modo TV são derivados dos lançamentos feitos na aplicação.

## Início rápido no Windows

**Não abra `frontend/index.html` diretamente.** O sistema depende da API e do PostgreSQL.

1. Instale e abra o **Docker Desktop** com WSL 2 funcionando.
2. Baixe esta branch: `mvp/hospital-prjt-v1`.
3. Na raiz do projeto, execute **`INICIAR_MVP.bat`**.
4. Aguarde `MVP operacional`.
5. A interface abrirá em `http://localhost:8080`.

Acesso administrativo:

- usuário: `admin`
- senha: `Admin123!`

Modo TV:

- endereço: `http://localhost:8080/tv`
- senha padrão: `troque-esta-senha`

Para desligar, execute **`PARAR_MVP.bat`**.

## Cenário demonstrativo

Na primeira inicialização desta versão o seed cria uma base integralmente fictícia para apresentação:

- **105 leitos cadastrados**: 95 de internação e 10 UTI;
- **120 pacientes fictícios**;
- **84 internações ativas**;
- **20 internações históricas com alta**;
- leitos livres, ocupados, bloqueados, reservados e em manutenção;
- **73 profissionais fictícios** entre médicos de várias especialidades, enfermagem, técnicos, fisioterapia, biomedicina, assistência social, maqueiros e administrativo;
- escala do mês corrente já preenchida;
- perfis de demonstração com diferentes níveis de acesso.

Contas de demonstração adicionais — senha `Demo123!`:

- `recepcao`
- `enfermagem`
- `escala`
- `gestor`

Os dados demonstrativos são inseridos uma vez e depois preservados para que possam ser alterados durante os testes.

### Recriar a demonstração do zero

Como esta versão foi desenhada para apresentação, caso queira limpar os testes anteriores e recriar toda a base fictícia:

```powershell
docker compose down -v
docker compose up --build -d
```

Isso apaga somente o banco Docker local deste projeto e recria o cenário demonstrativo.

## Fluxos disponíveis no MVP

- Pacientes: cadastro, busca, edição e histórico;
- Leitos: mapa com filtros, edição, ocupação, bloqueio, manutenção, reserva e liberação;
- Internações: admissão, transferência entre leitos, alta e histórico;
- Dashboard: capacidade, ocupação, leitos livres/ocupados/indisponíveis, internações, altas e LOS;
- Modo TV: visão operacional dos 105 leitos sem dados clínicos do paciente;
- Prontuário: evoluções e autoria;
- Profissionais: cadastro e edição por categoria, especialidade/área e registro/matrícula;
- Cadastro de profissional com opção de criar acesso ao sistema e selecionar permissões;
- Escala: visão mensal por turno, filtros, inclusão, repetição semanal, edição e remoção;
- Usuários: criação, edição, ativação/desativação e permissões por módulo;
- Importação/exportação de dados e backups já existentes no núcleo do MVP.

## Permissões

`ADMIN` possui acesso integral. Usuários comuns recebem permissões por módulo e ação (`read`, `write`, `delete`). Os módulos principais são `pacientes`, `leitos`, `internacoes`, `prontuario`, `profissionais`, `escala` e `dashboard`.

## Fluxo sugerido para apresentação

1. Entrar como `admin` e mostrar Dashboard/Leitos já populados.
2. Localizar ou editar um paciente.
3. Abrir uma nova internação em um leito livre.
4. Transferir o paciente para outro leito e observar a atualização do mapa.
5. Dar alta e confirmar a liberação automática do leito.
6. Abrir Profissionais, cadastrar um profissional e opcionalmente criar seu acesso.
7. Abrir Escala, inserir/repetir um plantão e editar ou remover uma alocação.
8. Entrar com uma conta de demonstração para mostrar restrição de acesso.
9. Abrir o Modo TV para demonstrar o reflexo operacional sem exibir informações clínicas.

## Desenvolvimento sem Docker

Backend:

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
node prisma/seed.js
npm start
```

Frontend:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Escopo desta etapa

Esta branch é um **MVP comercial e operacional para demonstração**, não uma implantação hospitalar de produção. O foco desta rodada é navegabilidade, edição, configuração e simulação coerente do trabalho. Hardening, requisitos regulatórios, segurança avançada e preparação definitiva para produção ficam para a etapa posterior à validação comercial do produto.
