ALTER TABLE "evolucoes"
  ADD COLUMN "internacaoId" TEXT,
  ADD COLUMN "profissionalId" TEXT,
  ADD COLUMN "templateId" TEXT,
  ADD COLUMN "templateVersao" INTEGER,
  ADD COLUMN "conteudo" JSONB,
  ADD COLUMN "evolucaoOrigemId" TEXT,
  ADD COLUMN "camposHerdados" JSONB,
  ADD COLUMN "assinadaEm" TIMESTAMP(3);

UPDATE "evolucoes" SET "assinadaEm" = "createdAt" WHERE "assinadaEm" IS NULL;

CREATE TABLE "templates_evolucao" (
  "id" TEXT NOT NULL,
  "codigo" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "categoriaProfissional" TEXT NOT NULL,
  "versao" INTEGER NOT NULL DEFAULT 1,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "schema" JSONB NOT NULL,
  "interface" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "templates_evolucao_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "medicoes_clinicas" (
  "id" TEXT NOT NULL,
  "pacienteId" TEXT NOT NULL,
  "internacaoId" TEXT,
  "evolucaoId" TEXT,
  "profissionalId" TEXT,
  "codigo" TEXT NOT NULL,
  "valorNumerico" DOUBLE PRECISION,
  "valorTexto" TEXT,
  "unidade" TEXT,
  "observadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criadoPor" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "medicoes_clinicas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "problemas_clinicos" (
  "id" TEXT NOT NULL,
  "pacienteId" TEXT NOT NULL,
  "internacaoId" TEXT,
  "descricao" TEXT NOT NULL,
  "codigo" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ATIVO',
  "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvidoEm" TIMESTAMP(3),
  "criadoPorProfissionalId" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "problemas_clinicos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "problemas_clinicos_eventos" (
  "id" TEXT NOT NULL,
  "problemaId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "valorAnterior" JSONB,
  "valorNovo" JSONB,
  "profissionalId" TEXT,
  "criadoPor" TEXT NOT NULL,
  "ocorridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "problemas_clinicos_eventos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "templates_evolucao_codigo_versao_key" ON "templates_evolucao"("codigo", "versao");
CREATE INDEX "templates_evolucao_categoriaProfissional_ativo_idx" ON "templates_evolucao"("categoriaProfissional", "ativo");
CREATE INDEX "evolucoes_internacaoId_idx" ON "evolucoes"("internacaoId");
CREATE INDEX "evolucoes_profissionalId_idx" ON "evolucoes"("profissionalId");
CREATE INDEX "evolucoes_templateId_idx" ON "evolucoes"("templateId");
CREATE INDEX "medicoes_clinicas_pacienteId_codigo_observadoEm_idx" ON "medicoes_clinicas"("pacienteId", "codigo", "observadoEm");
CREATE INDEX "medicoes_clinicas_internacaoId_idx" ON "medicoes_clinicas"("internacaoId");
CREATE INDEX "medicoes_clinicas_evolucaoId_idx" ON "medicoes_clinicas"("evolucaoId");
CREATE INDEX "problemas_clinicos_pacienteId_status_idx" ON "problemas_clinicos"("pacienteId", "status");
CREATE INDEX "problemas_clinicos_internacaoId_idx" ON "problemas_clinicos"("internacaoId");
CREATE INDEX "problemas_clinicos_eventos_problemaId_ocorridoEm_idx" ON "problemas_clinicos_eventos"("problemaId", "ocorridoEm");

ALTER TABLE "evolucoes" ADD CONSTRAINT "evolucoes_internacaoId_fkey"
  FOREIGN KEY ("internacaoId") REFERENCES "internacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "evolucoes" ADD CONSTRAINT "evolucoes_profissionalId_fkey"
  FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "evolucoes" ADD CONSTRAINT "evolucoes_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "templates_evolucao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "evolucoes" ADD CONSTRAINT "evolucoes_evolucaoOrigemId_fkey"
  FOREIGN KEY ("evolucaoOrigemId") REFERENCES "evolucoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "medicoes_clinicas" ADD CONSTRAINT "medicoes_clinicas_pacienteId_fkey"
  FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "medicoes_clinicas" ADD CONSTRAINT "medicoes_clinicas_internacaoId_fkey"
  FOREIGN KEY ("internacaoId") REFERENCES "internacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "medicoes_clinicas" ADD CONSTRAINT "medicoes_clinicas_evolucaoId_fkey"
  FOREIGN KEY ("evolucaoId") REFERENCES "evolucoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "medicoes_clinicas" ADD CONSTRAINT "medicoes_clinicas_profissionalId_fkey"
  FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "problemas_clinicos" ADD CONSTRAINT "problemas_clinicos_pacienteId_fkey"
  FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "problemas_clinicos" ADD CONSTRAINT "problemas_clinicos_internacaoId_fkey"
  FOREIGN KEY ("internacaoId") REFERENCES "internacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "problemas_clinicos" ADD CONSTRAINT "problemas_clinicos_criadoPorProfissionalId_fkey"
  FOREIGN KEY ("criadoPorProfissionalId") REFERENCES "profissionais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "problemas_clinicos_eventos" ADD CONSTRAINT "problemas_clinicos_eventos_problemaId_fkey"
  FOREIGN KEY ("problemaId") REFERENCES "problemas_clinicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "problemas_clinicos_eventos" ADD CONSTRAINT "problemas_clinicos_eventos_profissionalId_fkey"
  FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE SET NULL ON UPDATE CASCADE;
