CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');
CREATE TYPE "Sexo" AS ENUM ('M', 'F', 'OUTRO');
CREATE TYPE "TipoLeito" AS ENUM ('ENFERMARIA', 'UTI', 'ISOLAMENTO', 'SEMI_INTENSIVO');
CREATE TYPE "StatusLeito" AS ENUM ('LIVRE', 'OCUPADO', 'BLOQUEADO', 'MANUTENCAO', 'RESERVADO');
CREATE TYPE "StatusInternacao" AS ENUM ('ATIVA', 'FINALIZADA');
CREATE TYPE "TipoEvolucao" AS ENUM ('ENFERMAGEM', 'MEDICA', 'MULTIPROFISSIONAL');
CREATE TYPE "Turno" AS ENUM ('MANHA', 'TARDE', 'NOITE');

CREATE TABLE "usuarios" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "cargo" TEXT,
  "role" "Role" NOT NULL DEFAULT 'USER',
  "permissoes" JSONB,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pacientes" (
  "id" TEXT NOT NULL,
  "prontuario" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "cpf" TEXT,
  "dataNascimento" TIMESTAMP(3) NOT NULL,
  "sexo" "Sexo",
  "nomeAcompanhante" TEXT,
  "telefoneContato" TEXT,
  "diagnostico" TEXT,
  "precaucoes" TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" TEXT,
  CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leitos" (
  "id" TEXT NOT NULL,
  "numero" TEXT NOT NULL,
  "andar" INTEGER NOT NULL,
  "tipo" "TipoLeito" NOT NULL,
  "status" "StatusLeito" NOT NULL DEFAULT 'LIVRE',
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" TEXT,
  CONSTRAINT "leitos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bloqueios_leito" (
  "id" TEXT NOT NULL,
  "leitoId" TEXT NOT NULL,
  "tipo" "StatusLeito" NOT NULL,
  "motivo" TEXT NOT NULL,
  "dataInicio" TIMESTAMP(3) NOT NULL,
  "dataFim" TIMESTAMP(3),
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT NOT NULL,
  "liberadoEm" TIMESTAMP(3),
  "liberadoBy" TEXT,
  CONSTRAINT "bloqueios_leito_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "internacoes" (
  "id" TEXT NOT NULL,
  "pacienteId" TEXT NOT NULL,
  "leitoId" TEXT NOT NULL,
  "dataInternacao" TIMESTAMP(3) NOT NULL,
  "previsaoAlta" TIMESTAMP(3),
  "dataAlta" TIMESTAMP(3),
  "observacoesInternacao" TEXT,
  "observacoesAlta" TEXT,
  "status" "StatusInternacao" NOT NULL DEFAULT 'ATIVA',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT NOT NULL,
  "dataAltaRegistrada" TIMESTAMP(3),
  "altaBy" TEXT,
  CONSTRAINT "internacoes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evolucoes" (
  "id" TEXT NOT NULL,
  "pacienteId" TEXT NOT NULL,
  "sinaisVitais" JSONB,
  "queixas" TEXT,
  "condutaMedica" TEXT,
  "medicacoes" TEXT,
  "observacoes" TEXT NOT NULL,
  "tipo" "TipoEvolucao" NOT NULL DEFAULT 'ENFERMAGEM',
  "criadoPor" TEXT NOT NULL,
  "criadoPorNome" TEXT NOT NULL,
  "criadoPorCargo" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" TEXT,
  CONSTRAINT "evolucoes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profissionais" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "registroConselho" TEXT NOT NULL,
  "cargo" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" TEXT,
  CONSTRAINT "profissionais_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "escalas" (
  "id" TEXT NOT NULL,
  "profissionalId" TEXT NOT NULL,
  "data" TIMESTAMP(3) NOT NULL,
  "turno" "Turno" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" TEXT,
  CONSTRAINT "escalas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "logs_importacao" (
  "id" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "arquivo" TEXT NOT NULL,
  "resultado" JSONB NOT NULL,
  "importadoPor" TEXT NOT NULL,
  "dataImportacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "logs_importacao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usuarios_username_key" ON "usuarios"("username");
CREATE UNIQUE INDEX "usuarios_username_ci_key" ON "usuarios"(LOWER("username"));
CREATE UNIQUE INDEX "pacientes_prontuario_key" ON "pacientes"("prontuario");
CREATE UNIQUE INDEX "pacientes_cpf_key" ON "pacientes"("cpf");
CREATE INDEX "pacientes_nome_idx" ON "pacientes"("nome");
CREATE INDEX "pacientes_prontuario_idx" ON "pacientes"("prontuario");
CREATE UNIQUE INDEX "leitos_numero_key" ON "leitos"("numero");
CREATE INDEX "leitos_status_idx" ON "leitos"("status");
CREATE INDEX "leitos_numero_idx" ON "leitos"("numero");
CREATE INDEX "bloqueios_leito_leitoId_idx" ON "bloqueios_leito"("leitoId");
CREATE INDEX "internacoes_pacienteId_idx" ON "internacoes"("pacienteId");
CREATE INDEX "internacoes_leitoId_idx" ON "internacoes"("leitoId");
CREATE INDEX "internacoes_status_idx" ON "internacoes"("status");
CREATE UNIQUE INDEX "internacoes_paciente_ativa_unique" ON "internacoes"("pacienteId") WHERE "status" = 'ATIVA';
CREATE UNIQUE INDEX "internacoes_leito_ativo_unique" ON "internacoes"("leitoId") WHERE "status" = 'ATIVA';
CREATE INDEX "evolucoes_pacienteId_idx" ON "evolucoes"("pacienteId");
CREATE INDEX "evolucoes_createdAt_idx" ON "evolucoes"("createdAt");
CREATE UNIQUE INDEX "profissionais_registroConselho_key" ON "profissionais"("registroConselho");
CREATE INDEX "profissionais_nome_idx" ON "profissionais"("nome");
CREATE UNIQUE INDEX "escalas_profissionalId_data_turno_key" ON "escalas"("profissionalId", "data", "turno");
CREATE INDEX "escalas_data_idx" ON "escalas"("data");

ALTER TABLE "bloqueios_leito" ADD CONSTRAINT "bloqueios_leito_leitoId_fkey" FOREIGN KEY ("leitoId") REFERENCES "leitos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internacoes" ADD CONSTRAINT "internacoes_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internacoes" ADD CONSTRAINT "internacoes_leitoId_fkey" FOREIGN KEY ("leitoId") REFERENCES "leitos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evolucoes" ADD CONSTRAINT "evolucoes_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "escalas" ADD CONSTRAINT "escalas_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
