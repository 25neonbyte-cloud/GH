import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
const router = Router();
router.get('/leitos', authenticate, async (req,res)=>{
  const data=await prisma.leito.findMany({select:{numero:true,andar:true,tipo:true,status:true},orderBy:[{andar:'asc'},{numero:'asc'}]});
  res.json({data,ultimaAtualizacao:new Date()});
});
export default router;
