import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissions.js';
import { calcularLOS } from '../utils/los.js';
import { dashboardCache } from '../services/dashboardCache.js';

const router = Router();
router.use(authenticate, checkPermission('dashboard', 'read'));

async function calculate() {
  const today = new Date();
  today.setHours(0,0,0,0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate()+1);

  const [capacidadeTotal, totalLeitos, leitosLivres, leitosOcupados, leitosIndisponiveis, internacoes, internacoesHoje, altasHoje] = await Promise.all([
    prisma.leito.count(),
    prisma.leito.count({ where: { status: { in: ['LIVRE','OCUPADO'] } } }),
    prisma.leito.count({ where: { status: 'LIVRE' } }),
    prisma.leito.count({ where: { status: 'OCUPADO' } }),
    prisma.leito.count({ where: { status: { in: ['BLOQUEADO','MANUTENCAO','RESERVADO'] } } }),
    prisma.internacao.findMany({ where: { status: 'ATIVA' }, select: { dataInternacao: true } }),
    prisma.internacao.count({ where: { dataInternacao: { gte: today, lt: tomorrow } } }),
    prisma.internacao.count({ where: { dataAlta: { gte: today, lt: tomorrow } } }),
  ]);

  const mediaLOS = internacoes.length ? internacoes.reduce((a,i) => a + calcularLOS(i.dataInternacao),0) / internacoes.length : 0;
  return {
    taxaOcupacao: totalLeitos ? Number(((leitosOcupados / totalLeitos) * 100).toFixed(1)) : 0,
    capacidadeTotal,
    totalLeitos,
    leitosLivres,
    leitosOcupados,
    leitosIndisponiveis,
    internacoesAtivas: internacoes.length,
    mediaLOS: Number(mediaLOS.toFixed(1)),
    internacoesHoje,
    altasHoje,
    ultimaAtualizacao: new Date(),
  };
}

router.get('/indicadores', async (req,res) => res.json(dashboardCache.get() || dashboardCache.set(await calculate())));

router.get('/ocupacao-7dias', async (req,res) => {
  const result = [];
  for (let n = 6; n >= 0; n--) {
    const start = new Date(); start.setHours(0,0,0,0); start.setDate(start.getDate()-n);
    const end = new Date(start); end.setDate(start.getDate()+1);
    const admissions = await prisma.internacao.count({ where: { dataInternacao:{lt:end}, OR:[{dataAlta:null},{dataAlta:{gte:start}}] } });
    const total = await prisma.leito.count({ where: { status:{in:['LIVRE','OCUPADO']} } });
    result.push({ data:start.toISOString().slice(0,10), taxa:total ? Number(((admissions/total)*100).toFixed(1)) : 0 });
  }
  res.json({ data:result });
});

export default router;
