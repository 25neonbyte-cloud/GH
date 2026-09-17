import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
const prisma = new PrismaClient();

const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';

async function main() {
  const hash = await bcrypt.hash(adminPassword, 10);
  await prisma.usuario.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hash,
      nome: 'Administrador',
      cargo: 'ADMINISTRATIVO',
      role: 'ADMIN',
      permissoes: {},
    },
  });

  const leitos = [
    ['101', 1, 'ENFERMARIA'], ['102', 1, 'ENFERMARIA'], ['103', 1, 'ISOLAMENTO'],
    ['201', 2, 'UTI'], ['202', 2, 'UTI'], ['203', 2, 'SEMI_INTENSIVO'],
  ];
  for (const [numero, andar, tipo] of leitos) {
    await prisma.leito.upsert({
      where: { numero },
      update: {},
      create: { numero, andar, tipo, status: 'LIVRE', updatedBy: 'seed' },
    });
  }
}

main().finally(() => prisma.$disconnect());
