import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
const demoPassword = process.env.SEED_DEMO_PASSWORD || 'Demo123!';
const DEMO_MARKER = 'DEMO_MVP_COMERCIAL_V3';
const PREVIOUS_DEMO_MARKER = 'DEMO_MVP_COMERCIAL_V2';

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

async function repairBedStatuses() {
  const beds = await prisma.leito.findMany({
    include: {
      internacoes: { where: { status: 'ATIVA' }, select: { id: true }, take: 1 },
      bloqueios: { where: { ativo: true }, orderBy: { createdAt: 'desc' }, select: { tipo: true }, take: 1 },
    },
  });
  for (const bed of beds) {
    const desired = bed.internacoes.length ? 'OCUPADO' : (bed.bloqueios[0]?.tipo || bed.status);
    if (desired !== bed.status) {
      await prisma.leito.update({ where: { id: bed.id }, data: { status: desired, updatedBy: 'seed-demo-repair' } });
    }
  }
}

async function addDemoEvolutions(now = new Date()) {
  const patients = await prisma.paciente.findMany({
    where: { prontuario: { startsWith: '700' } },
    orderBy: { prontuario: 'asc' },
    take: 40,
  });
  for (let i = 0; i < patients.length; i++) {
    const paciente = patients[i];
    const existing = await prisma.evolucao.count({ where: { pacienteId: paciente.id, criadoPor: { startsWith: 'seed-demo' } } });
    if (existing) continue;
    for (let n = 0; n < 2; n++) {
      await prisma.evolucao.create({
        data: {
          pacienteId: paciente.id,
          sinaisVitais: { pa: `${110 + (i % 25)}/${70 + (i % 15)}`, fc: 72 + (i % 24), temp: Number((36.2 + ((i + n) % 8) / 10).toFixed(1)), spo2: 94 + (i % 6) },
          queixas: n === 0 ? 'Avaliação clínica de rotina no cenário demonstrativo.' : 'Paciente refere evolução do quadro nas últimas horas.',
          condutaMedica: n === 1 ? 'Manter acompanhamento e reavaliar conforme evolução clínica.' : null,
          medicacoes: i % 3 === 0 ? 'Medicações conforme prescrição simulada.' : null,
          observacoes: n === 0 ? 'Paciente avaliado, sinais vitais registrados e cuidados mantidos.' : 'Evolução fictícia para demonstração do prontuário e histórico longitudinal.',
          tipo: n === 0 ? 'ENFERMAGEM' : 'MEDICA',
          criadoPor: `seed-demo-${n === 0 ? 'enfermagem' : 'medico'}`,
          criadoPorNome: n === 0 ? 'Equipe de Enfermagem Demo' : 'Médico Plantonista Demo',
          criadoPorCargo: n === 0 ? 'ENFERMEIRO' : 'MÉDICO | CLÍNICA MÉDICA',
          createdAt: addDays(now, -n),
        },
      });
    }
  }
}

async function linkDemoUsers() {
  const recepcaoUser = await upsertUser({ username: 'recepcao', password: demoPassword, nome: 'Recepção Demo', cargo: 'RECEPÇÃO', permissoes: { pacientes: ['read','write'], leitos: ['read'], internacoes: ['read','write'], dashboard: ['read'], sync: ['read'] } });
  const enfermagemUser = await upsertUser({ username: 'enfermagem', password: demoPassword, nome: 'Enfermagem Demo', cargo: 'ENFERMEIRO', permissoes: { pacientes: ['read'], leitos: ['read'], internacoes: ['read'], prontuario: ['read','write'], escala: ['read'], dashboard: ['read'] } });
  const escalaUser = await upsertUser({ username: 'escala', password: demoPassword, nome: 'Gestão de Escala Demo', cargo: 'ADMINISTRATIVO', permissoes: { profissionais: ['read','write','delete'], escala: ['read','write','delete'], dashboard: ['read'] } });
  const gestorUser = await upsertUser({ username: 'gestor', password: demoPassword, nome: 'Gestor Demo', cargo: 'GESTÃO', permissoes: { pacientes: ['read','write'], leitos: ['read','write'], internacoes: ['read','write'], prontuario: ['read'], profissionais: ['read','write'], escala: ['read','write','delete'], dashboard: ['read'], sync: ['read','write'] } });

  const admins = await prisma.profissional.findMany({ where: { cargo: 'ADMINISTRATIVO', updatedBy: { startsWith: 'seed-demo' } }, orderBy: { registroConselho: 'asc' }, take: 3 });
  const nurse = await prisma.profissional.findFirst({ where: { cargo: 'ENFERMEIRO', updatedBy: { startsWith: 'seed-demo' } }, orderBy: { registroConselho: 'asc' } });
  const targets = [[enfermagemUser,nurse],[escalaUser,admins[0]],[gestorUser,admins[1]],[recepcaoUser,admins[2]]];

  for (const [user, professional] of targets) {
    if (!professional) continue;
    const alreadyLinked = await prisma.profissional.findFirst({ where: { usuarioId: user.id } });
    if (!alreadyLinked && !professional.usuarioId) {
      await prisma.profissional.update({ where: { id: professional.id }, data: { usuarioId: user.id } });
    }
  }
}

async function markDemoV3(source) {
  const existing = await prisma.logImportacao.findFirst({ where: { tipo: DEMO_MARKER } });
  if (existing) return;
  await prisma.logImportacao.create({
    data: {
      tipo: DEMO_MARKER,
      arquivo: 'seed interno demonstrativo',
      importadoPor: 'seed-demo',
      resultado: { versao: 3, source, observacao: 'Base demonstrativa atualizada de forma idempotente.' },
    },
  });
}

async function ensureClinicalTemplates() {
  const templates = [
    {
      codigo: 'MEDICA_PADRAO',
      nome: 'Evolução médica',
      categoriaProfissional: 'MEDICA',
      versao: 1,
      schema: { fields: [
        { key:'estadoGeral', label:'Estado geral', type:'select', options:['Bom','Regular','Grave'], required:false },
        { key:'queixaPrincipal', label:'Queixa / evolução do quadro', type:'textarea', required:false },
        { key:'exameFisico', label:'Exame físico', type:'textarea', required:false },
        { key:'avaliacao', label:'Avaliação / impressão clínica', type:'textarea', required:false },
        { key:'conduta', label:'Conduta', type:'textarea', required:false },
        { key:'observacao', label:'Evolução médica', type:'textarea', required:true },
      ]},
      interface: { sections:[
        { title:'Avaliação clínica', fields:['estadoGeral','queixaPrincipal','exameFisico','avaliacao'] },
        { title:'Plano', fields:['conduta','observacao'] },
      ]},
    },
    {
      codigo: 'ENFERMAGEM_PADRAO',
      nome: 'Evolução de enfermagem',
      categoriaProfissional: 'ENFERMAGEM',
      versao: 1,
      schema: { fields: [
        { key:'estadoGeral', label:'Estado geral', type:'select', options:['Bom','Regular','Grave'], required:false },
        { key:'nivelConsciencia', label:'Nível de consciência', type:'select', options:['Alerta','Sonolento','Obnubilado','Inconsciente'], required:false },
        { key:'dor', label:'Dor (0–10)', type:'number', min:0, max:10, required:false },
        { key:'pele', label:'Integridade da pele', type:'select', options:['Preservada','Lesão presente','Risco aumentado'], required:false },
        { key:'mobilidade', label:'Mobilidade', type:'select', options:['Independente','Assistida','Restrita ao leito'], required:false },
        { key:'dieta', label:'Dieta / aceitação', type:'text', required:false },
        { key:'eliminacoes', label:'Eliminações', type:'text', required:false },
        { key:'dispositivos', label:'Dispositivos / acessos', type:'textarea', required:false },
        { key:'observacao', label:'Evolução de enfermagem', type:'textarea', required:true },
      ]},
      interface: { sections:[
        { title:'Avaliação', fields:['estadoGeral','nivelConsciencia','dor','pele','mobilidade'] },
        { title:'Cuidados', fields:['dieta','eliminacoes','dispositivos','observacao'] },
      ]},
    },
    {
      codigo: 'FISIOTERAPIA_PADRAO',
      nome: 'Evolução fisioterapêutica',
      categoriaProfissional: 'FISIOTERAPIA',
      versao: 1,
      schema: { fields: [
        { key:'padraoRespiratorio', label:'Padrão respiratório', type:'select', options:['Eupneico','Taquipneico','Bradipneico','Dispneico'], required:false },
        { key:'oxigenoterapia', label:'Oxigenoterapia', type:'select', options:['Não','Sim'], required:false },
        { key:'dispositivoO2', label:'Dispositivo de O₂', type:'text', required:false },
        { key:'fluxoO2', label:'Fluxo O₂ (L/min)', type:'number', min:0, max:60, required:false },
        { key:'mobilidade', label:'Mobilidade', type:'select', options:['Independente','Assistida','Restrita ao leito'], required:false },
        { key:'forcaMuscular', label:'Força muscular (0–5)', type:'number', min:0, max:5, required:false },
        { key:'condutaFisio', label:'Conduta fisioterapêutica', type:'textarea', required:false },
        { key:'observacao', label:'Evolução fisioterapêutica', type:'textarea', required:true },
      ]},
      interface: { sections:[
        { title:'Respiratório', fields:['padraoRespiratorio','oxigenoterapia','dispositivoO2','fluxoO2'] },
        { title:'Funcional', fields:['mobilidade','forcaMuscular','condutaFisio','observacao'] },
      ]},
    },
    {
      codigo: 'MULTIPROFISSIONAL_PADRAO',
      nome: 'Evolução multiprofissional',
      categoriaProfissional: 'MULTIPROFISSIONAL',
      versao: 1,
      schema: { fields: [
        { key:'avaliacao', label:'Avaliação', type:'textarea', required:false },
        { key:'intervencao', label:'Intervenção realizada', type:'textarea', required:false },
        { key:'plano', label:'Plano / acompanhamento', type:'textarea', required:false },
        { key:'observacao', label:'Evolução multiprofissional', type:'textarea', required:true },
      ]},
      interface: { sections:[{ title:'Evolução', fields:['avaliacao','intervencao','plano','observacao'] }] },
    },
  ];

  for (const template of templates) {
    await prisma.templateEvolucao.upsert({
      where: { codigo_versao: { codigo: template.codigo, versao: template.versao } },
      update: { ativo:true, nome:template.nome, categoriaProfissional:template.categoriaProfissional },
      create: template,
    });
  }
}

async function main() {
  await ensureClinicalTemplates();
  await upsertUser({ username: 'admin', password: adminPassword, nome: 'Administrador', cargo: 'ADMINISTRATIVO', role: 'ADMIN', permissoes: {} });

  const marker = await prisma.logImportacao.findFirst({ where: { tipo: DEMO_MARKER } });
  if (marker) {
    console.log('Base demonstrativa V3 já carregada. Seed preservado.');
    return;
  }

  const previousMarker = await prisma.logImportacao.findFirst({ where: { tipo: PREVIOUS_DEMO_MARKER } });
  const existingDemoPatients = await prisma.paciente.count({ where: { prontuario: { startsWith: '700' } } });
  const existingDemoBeds = await prisma.leito.count();

  if (previousMarker || (existingDemoPatients >= 50 && existingDemoBeds >= 50)) {
    console.log('Atualizando base demonstrativa existente para V3 sem recriar internações...');
    await repairBedStatuses();
    await addDemoEvolutions();
    await linkDemoUsers();
    await repairBedStatuses();
    await markDemoV3(previousMarker ? 'upgrade-v2' : 'recovery-existing-demo');
    console.log('Base demonstrativa atualizada para V3 e consistência dos leitos restaurada.');
    return;
  }

  console.log('Carregando cenário demonstrativo V3 do Hospital PRJT em banco novo...');

  // Cenário baseado na capacidade informada: 95 leitos de internação + 10 UTI = 105 leitos.
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
      update: { andar: b.andar, tipo: b.tipo, observacoes: b.observacoes, updatedBy: 'seed-demo' },
      create: { ...b, status: 'LIVRE', updatedBy: 'seed-demo' },
    });
  }

  // 120 pacientes fictícios: 84 internados, 20 com alta e 16 apenas cadastrados.
  const patients = [];
  for (let i = 0; i < 120; i++) {
    const prontuario = String(700001 + i);
    const isolamento = i >= 68 && i < 72;
    patients.push(await prisma.paciente.upsert({
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
    }));
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
    const [existingByPatient, existingByBed] = await Promise.all([
      prisma.internacao.findFirst({ where: { pacienteId: paciente.id, status: 'ATIVA' } }),
      prisma.internacao.findFirst({ where: { leitoId: leito.id, status: 'ATIVA' } }),
    ]);
    if (!existingByPatient && !existingByBed) {
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
      await prisma.leito.update({ where: { id: leito.id }, data: { status: 'OCUPADO', updatedBy: 'seed-demo' } });
    } else if (existingByBed) {
      await prisma.leito.update({ where: { id: leito.id }, data: { status: 'OCUPADO', updatedBy: 'seed-demo' } });
    }
  }

  // Histórico de altas para alimentar dashboard e navegação histórica.
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

  await addDemoEvolutions(now);

  // Estados operacionais em leitos livres: manutenção, bloqueio e reserva.
  const freeSemi = bedSpecs.filter(b => b.tipo === 'SEMI_INTENSIVO').slice(4, 7);
  const unavailable = [
    { numero: freeSemi[0].numero, tipo: 'MANUTENCAO', motivo: 'Manutenção preventiva simulada' },
    { numero: freeSemi[1].numero, tipo: 'BLOQUEADO', motivo: 'Higienização terminal simulada' },
    { numero: freeSemi[2].numero, tipo: 'RESERVADO', motivo: 'Reserva para transferência interna simulada' },
  ];
  for (const u of unavailable) {
    const leito = bedByNumber.get(u.numero);
    await prisma.leito.update({ where: { id: leito.id }, data: { status: u.tipo, updatedBy: 'seed-demo' } });
    const exists = await prisma.bloqueioLeito.findFirst({ where: { leitoId: leito.id, ativo: true } });
    if (!exists) await prisma.bloqueioLeito.create({ data: { leitoId: leito.id, tipo: u.tipo, motivo: u.motivo, dataInicio: now, ativo: true, createdBy: 'seed-demo' } });
  }

  // Corpo multidisciplinar fictício para demonstrar cadastro e escala.
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

  // Escala demonstrativa do mês corrente.
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

  await linkDemoUsers();
  await repairBedStatuses();
  await markDemoV3('fresh-seed');

  console.log(`Cenário demonstrativo V3 carregado: 105 leitos, 120 pacientes, 84 internações ativas e ${professionals.length} profissionais.`);
}

main()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
