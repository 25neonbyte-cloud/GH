import { createRouter } from '../utils/asyncRouter.js'; import { authenticate } from '../middleware/auth.js'; import { adminOnly } from '../middleware/permissions.js'; import { createBackup,listBackups,backupPath,restoreBackup } from '../services/backupService.js';
const router=createRouter(); router.use(authenticate,adminOnly);
router.get('/',async(req,res)=>res.json({data:await listBackups()}));
router.post('/manual',async(req,res)=>res.status(201).json(await createBackup()));
router.get('/:file/download',(req,res)=>res.download(backupPath(req.params.file)));
router.post('/:file/restore',async(req,res)=>{await restoreBackup(req.params.file);res.json({ok:true});});
export default router;
