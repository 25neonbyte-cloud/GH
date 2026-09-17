import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
const demoPassword = process.env.SEED_DEMO_PASSWORD || 'Demo123!';
const DEMO_MARKER = 'DEMO_MVP_COMERCIAL_V2';

const nomes = ['Ana','Bruno','Carla','Daniel','Eduarda','Felipe','Gabriela','Henrique','Isabela','João','Karina','Lucas','Mariana','Nicolas','Olívia','Paulo','Renata','Samuel','Tatiana','Vinícius'];
const sobrenomes = ['Almeida','Barbosa','Cardoso','Dias','Ferreira','Gomes','Lima','Martins','Mendes','Moreira','Nascimento','Oliveira','Pereira','Ribeiro','Rocha','Rodrigues','Santos','Silva','Souza','Teixeira'];
const diagnosticos = ['Pneumonia','Fratura de fêmur','Dor abdominal aguda','Insuficiência cardíaca','Pós-operatório de colecistectomia','Infecção urinária','Trauma ortopédico','Crise hipertensiva','Apendicite','DPOC exacerbada','Pós-operatório ortopédico','Desidratação','Insuficiência respiratória','Sepse em tratamento','Dor torácica em investigação'];

function nomePessoa(i, offset = 0) {
  const a = nomes[(i + offset) % nomes.length];
  const b = sobrenomes[Math.floor(i / nomes.length) % sobrenomes.length];
  const c = sobrenomes[(i * 7 + offset + 3) % sobrenomes.length];
  return `${a} ${b} ${c}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function upsertUser({ username, password, nome, cargo, role = 'USER', permissoes = {} }) {
  const hash = await bcrypt.hash(password, 10);
  return prisma.usuario.upsert({
    where: { username },
    update: { nome, cargo, role, permissoes, ativo: true, password: hash },
    create: { username, password: hash, nome, cargo, role, permissoes, ativo: true },
  });
}

async function main() {
  await upsertUser({ username: 'admin', password: adminPassword, nome: 'Administrador', cargo: 'ADMINISTRATIVO', role: 'ADMIN', permissoes: {} });

  const marker = await prisma.logImportacao.findFirst({ where: { tipo: DEMO_MARKER } });
  if (marker) {
    console.log('Base demonstrativa já carregada. Seed preservado.');
    return;
  }

  console.log('Carregando cenário demonstrativo do Hospital PRJT...');

  // 105 leitos operacionais: 95 de internação + 10 UTI.
  const bedSpecs = [];
  for (let i = 0; i < 95; i++) {
    let numero;
    let andar;
    if (i < 35) { andar = 1; numero = String(101 + i); }
    else if (i < 65) { andar = 2; numero = String(201 + (i - 35)); }
    else { andar = 3; numero = String(301 + (i - 65)); }
    const tipo = i < 79 ? 'ENFERMARIA' : i < 87 ? 'ISOLAMENTO' : 'SEMI_INTENSIVO';
    const setor = i < 48 ? 'Clínica médica' : 'Clínica cirúrgica';
    bedSpecs.push({ numero, andar, tipo, observacoes: `${setor} · cenário demonstrativo` });
  }
  for (let i = 1; i <= 10; i++) {
    bedSpecs.push({ numero: `UTI-${String(i).padStart(2, '0')}`, andar: 1, tipo: 'UTI', observacoes: 'Unidade de Terapia Intensiva · cenário demonstrativo' });
  }

  for (const b of bedSpecs) {
    await prisma.leito.upsert({
      where: { numero: b.numero },
      update: { andar: b.andar, tipo: b.tipo, observacoes: b.observacoes, status: 'LIVRE', updatedBy: 'seed-demo' },
      create: { ...b, status: 'LIVRE', updatedBy: 'seed-demo' },
    });
  }

  // 120 pacientes fictícios: 84 internados, 20 com alta e 16 apenas cadastrados.
  const patients = [];
  for (let i = 0; i < 120; i++) {
    const prontuario = String(700001 + i);
    const isolamento = i >= 68 && i < 72;
    const p = await prisma.paciente.upsert({
      where: { prontuario },
      update: {},
      create: {
        prontuario,
        nome: nomePessoa(i),
        cpf: null,
        dataNascimento: new Date(Date.UTC(1942 + ((i * 3) % 65), (i * 7) % 12, 1 + ((i * 11) % 27))),
        sexo: i % 2 === 0 ? 'F' : 'M',
        nomeAcompanhante: i % 4 === 0 ? nomePessoa(i + 11, 5) : null,
        telefoneContato: `(62) 9${String(80000000 + i).padStart(8, '0')}`,
        diagnostico: diagnosticos[i % diagnosticos.length],
        precaucoes: isolamento ? ['ISOLAMENTO'] : (i % 17 === 0 ? ['ALERGIA_LATEX'] : []),
        updatedBy: 'seed-demo',
      },
    });
    patients.push(p);
  }

  const allBeds = await prisma.leito.findMany({ where: { numero: { in: bedSpecs.map(b => b.numero) } } });
  const bedByNumber = new Map(allBeds.map(b => [b.numero, b]));
  const activeBedSpecs = [
    ...bedSpecs.filter(b => b.tipo === 'ENFERMARIA').slice(0, 68),
    ...bedSpecs.filter(b => b.tipo === 'ISOLAMENTO').slice(0, 4),
    ...bedSpecs.filter(b => b.tipo === 'SEMI_INTENSIVO').slice(0, 4),
    ...bedSpecs.filter(b => b.tipo === 'UTI').slice(0, 8),
  ];
  const now = new Date();

  for (let i = 0; i < 84; i++) {
    const paciente = patients[i];
    const leito = bedByNumber.get(activeBedSpecs[i].numero);
    const existing = await prisma.internacao.findFirst({ where: { pacienteId: paciente.id, status: 'ATIVA' } });
    if (!existing) {
      await prisma.internacao.create({
        data: {
          pacienteId: paciente.id,
          leitoId: leito.id,
          dataInternacao: addDays(now, -(i % 11)),
          previsaoAlta: addDays(now, 1 + (i % 5)),
          observacoesInternacao: 'Internação fictícia para demonstração comercial do MVP.',
          status: 'ATIVA',
          createdBy: 'seed-demo',
        },
      });
    }
    await prisma.leito.update({ where: { id: leito.id }, data: { status: 'OCUPADO', updatedBy: 'seed-demo' } });
  }

  for (let i = 84; i < 104; i++) {
    const paciente = patients[i];
    const leito = bedByNumber.get(bedSpecs[(i - 84) % 20].numero);
    const existing = await prisma.internacao.findFirst({ where: { pacienteId: paciente.id, status: 'FINALIZADA', createdBy: 'seed-demo' } });
    if (!existing) {
      const entrada = addDays(now, -(4 + (i % 9)));
      const alta = i < 89 ? new Date() : addDays(entrada, 2 + (i % 4));
      await prisma.internacao.create({
        data: {
          pacienteId: paciente.id,
          leitoId: leito.id,
          dataInternacao: entrada,
          previsaoAlta: alta,
          dataAlta: alta,
          dataAltaRegistrada: alta,
          observacoesInternacao: 'Internação histórica fictícia para demonstração.',
          observacoesAlta: 'Alta clínica simulada.',
          status: 'FINALIZADA',
          createdBy: 'seed-demo',
          altaBy: 'seed-demo',
        },
      });
    }
  }

  const unavailable = [
    { numero: bedSpecs[90].numero, tipo: 'MANUTENCAO', motivo: 'Manutenção preventiva simulada' },
    { numero: bedSpecs[91].numero, tipo: 'BLOQUEADO', motivo: 'Higienização terminal simulada' },
    { numero: bedSpecs[92].numero, tipo: 'RESERVADO', motivo: 'Reserva para transferência interna simulada' },
  ];
  for (const u of unavailable) {
    const leito = bedByNumber.get(u.numero);
    await prisma.leito.update({ where: { id: leito.id }, data: { status: u.tipo, updatedBy: 'seed-demo' } });
    const exists = await prisma.bloqueioLeito.findFirst({ where: { leitoId: leito.id, ativo: true } });
    if (!exists) await prisma.bloqueioLeito.create({ data: { leitoId: leito.id, tipo: u.tipo, motivo: u.motivo, dataInicio: now, ativo: true, createdBy: 'seed-demo' } });
  }

  const professionalSpecs = [];
  const medicalSpecialties = ['EMERGENCISTA','CIRURGIA GERAL','ORTOPEDIA','MEDICINA INTENSIVA','PEDIATRIA','CARDIOLOGIA','ANESTESIOLOGIA','CLÍNICA MÉDICA','NEUROLOGIA','RADIOLOGIA','INFECTOLOGIA','GASTROENTEROLOGIA'];
  for (let i = 0; i < 18; i++) professionalSpecs.push({ nome: nomePessoa(200 + i, 2), registro: `CRM-GO ${10001 + i}`, cargo: `MÉDICO | ${medicalSpecialties[i % medicalSpecialties.length]}` });
  for (let i = 0; i < 12; i++) professionalSpecs.push({ nome: nomePessoa(230 + i, 4), registro: `COREN-GO ${20001 + i}`, cargo: 'ENFERMEIRO' });
  for (let i = 0; i < 22; i++) professionalSpecs.push({ nome: nomePessoa(250 + i, 6), registro: `COREN-GO ${30001 + i}`, cargo: 'TÉCNICO DE ENFERMAGEM' });
  for (let i = 0; i < 6; i++) professionalSpecs.push({ nome: nomePessoa(280 + i, 8), registro: `CREFITO-GO ${40001 + i}`, cargo: 'FISIOTERAPEUTA' });
  for (let i = 0; i < 3; i++) professionalSpecs.push({ nome: nomePessoa(290 + i, 10), registro: `CRBM-GO ${45001 + i}`, cargo: 'BIOMÉDICO' });
  for (let i = 0; i < 3; i++) professionalSpecs.push({ nome: nomePessoa(295 + i, 12), registro: `CRESS-GO ${47001 + i}`, cargo: 'ASSISTENTE SOCIAL' });
  for (let i = 0; i < 5; i++) professionalSpecs.push({ nome: nomePessoa(300 + i, 14), registro: `MAT-${50001 + i}`, cargo: 'MAQUEIRO' });
  for (let i = 0; i < 4; i++) professionalSpecs.push({ nome: nomePessoa(310 + i, 16), registro: `MAT-${60001 + i}`, cargo: 'ADMINISTRATIVO' });

  const professionals = [];
  for (const p of professionalSpecs) {
    professionals.push(await prisma.profissional.upsert({
      where: { registroConselho: p.registro },
      update: { nome: p.nome, cargo: p.cargo, ativo: true, updatedBy: 'seed-demo' },
      create: { nome: p.nome, registroConselho: p.registro, cargo: p.cargo, ativo: true, updatedBy: 'seed-demo' },
    }));
  }

  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const turnos = ['MANHA', 'TARDE', 'NOITE'];
  for (let i = 0; i < professionals.length; i++) {
    for (let n = 0; n < 5; n++) {
      const data = new Date(Date.UTC(y, m, 1 + ((i * 3 + n * 5) % 28)));
      const turno = turnos[(i + n) % turnos.length];
      await prisma.escala.upsert({
        where: { profissionalId_data_turno: { profissionalId: professionals[i].id, data, turno } },
        update: {},
        create: { profissionalId: professionals[i].id, data, turno, updatedBy: 'seed-demo' },
      });
    }
  }

  await upsertUser({ username: 'recepcao', password: demoPassword, nome: 'Recepção Demo', cargo: 'RECEPÇÃO', permissoes: { pacientes: ['read','write'], leitos: ['read'], internacoes: ['read','write'], dashboard: ['read'] } });
  await upsertUser({ username: 'enfermagem', password: demoPassword, nome: 'Enfermagem Demo', cargo: 'ENFERMEIRO', permissoes: { pacientes: ['read'], leitos: ['read'], internacoes: ['read'], prontuario: ['read','write'], escala: ['read'], dashboard: ['read'] } });
  await upsertUser({ username: 'escala', password: demoPassword, nome: 'Gestão de Escala Demo', cargo: 'ADMINISTRATIVO', permissoes: { profissionais: ['read','write','delete'], escala: ['read','write','delete'], dashboard: ['read'] } });
  await upsertUser({ username: 'gestor', password: demoPassword, nome: 'Gestor Demo', cargo: 'GESTÃO', permissoes: { pacientes: ['read','write'], leitos: ['read','write'], internacoes: ['read','write'], prontuario: ['read'], profissionais: ['read','write'], escala: ['read','write','delete'], dashboard: ['read'] } });

  await prisma.logImportacao.create({
    data: {
      tipo: DEMO_MARKER,
      arquivo: 'seed interno demonstrativo',
      importadoPor: 'seed-demo',
      resultado: { leitos: 105, pacientes: 120, internacoesAtivas: 84, altasHistoricas: 20, profissionais: professionals.length, observacao: 'Dados integralmente fictícios para apresentação.' },
    },
  });

  console.log(`Cenário demonstrativo carregado: 105 leitos, 120 pacientes, 84 internações ativas e ${professionals.length} profissionais.`);
}

main()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
