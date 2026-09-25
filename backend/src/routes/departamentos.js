import { createRouter } from '../utils/asyncRouter.js';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router=createRouter();
router.use(authenticate);

router.get('/',async(req,res)=>{
  const data=await prisma.departamento.findMany({where:{ativo:true},orderBy:{nome:'asc'}});
  res.json({data});
});

export default router;
