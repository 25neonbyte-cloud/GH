ALTER TABLE "profissionais" ADD COLUMN "usuarioId" TEXT;

CREATE UNIQUE INDEX "profissionais_usuarioId_key" ON "profissionais"("usuarioId");

ALTER TABLE "profissionais"
ADD CONSTRAINT "profissionais_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
