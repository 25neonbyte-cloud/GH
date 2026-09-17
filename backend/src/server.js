import 'dotenv/config';
import cron from 'node-cron';
import { app } from './app.js';
import { prisma } from './lib/prisma.js';
import { createBackup } from './services/backupService.js';
const port=Number(process.env.PORT||3001);
const server=app.listen(port,()=>console.log(`PRJT Hospital API em http://localhost:${port}`));
cron.schedule('0 */6 * * *',()=>createBackup().then(r=>console.log('Backup automático:',r.file)).catch(e=>console.error('Falha no backup automático:',e.message)));
async function shutdown(){server.close();await prisma.$disconnect();process.exit(0);}process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
