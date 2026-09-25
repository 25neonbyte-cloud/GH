import { createRouter } from '../utils/asyncRouter.js';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissions.js';
import { assert, senhaForte } from '../utils/validation.js';

const router = createRouter();
router.use(authenticate);

const userSelect = { id:true, username:true, nome:true, cargo:true, role:true, permissoes:true, ativo:true };
const withUser = {
  usuario:{ select:userSelect },
  departamentoPrincipal:true,
  indisponibilidades:{ where:{ativo:true}, orderBy:{inicio:'desc'}, take:3 },
};

function requireAdminForAccess(req, acesso) {
  if (acesso !== undefined) assert(req.user?.role === 'ADMIN', 'Somente administrador pode alterar acesso ao sistema', 403);
}

async function ensureUsernameAvailable(tx, username, ignoreId) {
  const exists = await tx.usuario.findFirst({
    where: { username:{ equals:username, mode:'insensitive' }, ...(ignoreId ? { NOT:{ id:ignoreId } } : {}) },
  });
  assert(!exists, 'Username já cadastrado', 409, 'DUPLICATE_USERNAME');
}

function brasiliaIsoDate(){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}

function dateOnly(value){
  return new Date(String(value).slice(0,10)+'T00:00:00.000Z');
}

function addDays(date,days){
  const d=new Date(date);
  d.setUTCDate(d.getUTCDate()+days);
  return d;
}

async function assertDepartamento(tx,id){
  if(!id)return null;
  const dep=await tx.departamento.findUnique({where:{id}});
  assert(dep?.ativo,'Departamento não encontrado ou inativo',400);
  return dep;
}

router.get('/', checkPermission('profissionais','read'), async (req,res) => {
  const { search='', ativo, departamentoId } = req.query;
  const data = await prisma.profissional.findMany({
    where:{
      ...(ativo !== undefined && { ativo:ativo === 'true' }),
      ...(departamentoId && { departamentoPrincipalId:departamentoId }),
      ...(search && { OR:[
        { nome:{contains:search,mode:'insensitive'} },
        { registroConselho:{contains:search,mode:'insensitive'} },
        { cargo:{contains:search,mode:'insensitive'} },
        { departamentoPrincipal:{nome:{contains:search,mode:'insensitive'}} },
      ]}),
    },
    include:withUser,
    orderBy:{nome:'asc'},
  });
  res.json({data});
});

router.get('/:id/impacto-inativacao', checkPermission('profissionais','write'), async (req,res) => {
  const profissional = await prisma.profissional.findUnique({ where:{id:req.params.id} });
  assert(profissional, 'Profissional não encontrado', 404);

  const inicio=dateOnly(brasiliaIsoDate());
  const dias=Math.max(1,Math.min(365,Number(req.query.dias||1)));
  const fim=addDays(inicio,dias-1);
  const [escalasFuturas,escalasPeriodo]=await Promise.all([
    prisma.escala.count({where:{profissionalId:req.params.id,data:{gte:inicio}}}),
    prisma.escala.count({where:{profissionalId:req.params.id,data:{gte:inicio,lte:fim}}}),
  ]);

  res.json({
    escalasFuturas,
    escalasPeriodo,
    dias,
    inicio:inicio.toISOString(),
    fim:fim.toISOString(),
  });
});

router.post('/', checkPermission('profissionais','write'), async (req,res) => {
  const { nome, registroConselho, cargo, departamentoPrincipalId, acesso } = req.body;
  assert(nome && registroConselho && cargo, 'Nome, registro e cargo são obrigatórios');
  assert(departamentoPrincipalId, 'Departamento principal é obrigatório');
  requireAdminForAccess(req, acesso);

  let passwordHash = null;
  if (acesso?.enabled) {
    assert(acesso.username, 'Usuário é obrigatório para conceder acesso');
    assert(senhaForte(acesso.password), 'Senha deve ter no mínimo 8 caracteres, com letra e número');
    passwordHash = await bcrypt.hash(acesso.password, 10);
  }

  const data = await prisma.$transaction(async tx => {
    await assertDepartamento(tx,departamentoPrincipalId);
    let usuarioId = null;
    if (acesso?.enabled) {
      await ensureUsernameAvailable(tx, acesso.username);
      const user = await tx.usuario.create({
        data:{
          username:acesso.username.trim(),
          password:passwordHash,
          nome:nome.trim(),
          cargo,
          role:'USER',
          permissoes:acesso.permissoes || {},
          ativo:true,
        },
      });
      usuarioId = user.id;
    }

    return tx.profissional.create({
      data:{
        nome:nome.trim(),
        registroConselho:registroConselho.trim(),
        cargo,
        departamentoPrincipalId,
        usuarioId,
        updatedBy:req.user.username,
      },
      include:withUser,
    });
  });

  res.status(201).json(data);
});

router.put('/:id', checkPermission('profissionais','write'), async (req,res) => {
  const { nome, registroConselho, cargo, ativo, departamentoPrincipalId, acesso } = req.body;
  requireAdminForAccess(req, acesso);

  const current = await prisma.profissional.findUnique({ where:{id:req.params.id}, include:withUser });
  assert(current, 'Profissional não encontrado', 404);

  let passwordHash = null;
  if (acesso?.enabled && acesso.password) {
    assert(senhaForte(acesso.password), 'Senha deve ter no mínimo 8 caracteres, com letra e número');
    passwordHash = await bcrypt.hash(acesso.password, 10);
  }

  const result = await prisma.$transaction(async tx => {
    if(departamentoPrincipalId!==undefined) {
      assert(departamentoPrincipalId,'Departamento principal é obrigatório');
      await assertDepartamento(tx,departamentoPrincipalId);
    }

    let usuarioId = current.usuarioId;

    if (acesso !== undefined) {
      if (acesso.enabled) {
        if (current.usuario) {
          const username = (acesso.username || current.usuario.username).trim();
          await ensureUsernameAvailable(tx, username, current.usuario.id);
          await tx.usuario.update({
            where:{id:current.usuario.id},
            data:{
              username,
              nome:(nome ?? current.nome).trim(),
              cargo:cargo ?? current.cargo,
              permissoes:acesso.permissoes ?? current.usuario.permissoes ?? {},
              ativo:acesso.ativo !== false,
              ...(passwordHash ? { password:passwordHash } : {}),
            },
          });
        } else {
          assert(acesso.username, 'Usuário é obrigatório para conceder acesso');
          assert(passwordHash, 'Senha inicial é obrigatória ao criar o acesso');
          await ensureUsernameAvailable(tx, acesso.username);
          const user = await tx.usuario.create({
            data:{
              username:acesso.username.trim(),
              password:passwordHash,
              nome:(nome ?? current.nome).trim(),
              cargo:cargo ?? current.cargo,
              role:'USER',
              permissoes:acesso.permissoes || {},
              ativo:acesso.ativo !== false,
            },
          });
          usuarioId = user.id;
        }
      } else if (current.usuario) {
        await tx.usuario.update({ where:{id:current.usuario.id}, data:{ativo:false} });
      }
    }

    return tx.profissional.update({
      where:{id:req.params.id},
      data:{
        ...(nome !== undefined && {nome:nome.trim()}),
        ...(registroConselho !== undefined && {registroConselho:registroConselho.trim()}),
        ...(cargo !== undefined && {cargo}),
        ...(ativo !== undefined && {ativo}),
        ...(departamentoPrincipalId !== undefined && {departamentoPrincipalId}),
        ...(usuarioId !== current.usuarioId && {usuarioId}),
        updatedBy:req.user.username,
      },
      include:withUser,
    });
  });

  res.json(result);
});

router.post('/:id/inativar', checkPermission('profissionais','delete'), async (req,res) => {
  const modo=String(req.body.modo||'INDETERMINADA').toUpperCase();
  assert(['TEMPORARIA','INDETERMINADA'].includes(modo),'Modo de inativação inválido');
  const dias=Math.max(1,Math.min(365,Number(req.body.dias||1)));
  const motivo=String(req.body.motivo||'').trim()||null;
  const inicio=dateOnly(brasiliaIsoDate());
  const fim=modo==='TEMPORARIA'?addDays(inicio,dias-1):null;

  const result = await prisma.$transaction(async tx => {
    const profissional = await tx.profissional.findUnique({ where:{id:req.params.id}, include:withUser });
    assert(profissional, 'Profissional não encontrado', 404);

    const whereEscala={
      profissionalId:req.params.id,
      data: modo==='TEMPORARIA' ? {gte:inicio,lte:fim} : {gte:inicio},
    };
    const afetadas=await tx.escala.findMany({
      where:whereEscala,
      include:{departamento:true},
      orderBy:[{data:'asc'},{turno:'asc'}],
    });
    if(afetadas.length) await tx.escala.deleteMany({where:whereEscala});

    await tx.indisponibilidadeProfissional.updateMany({
      where:{profissionalId:req.params.id,ativo:true},
      data:{ativo:false,encerradoEm:new Date(),encerradoBy:req.user.username},
    });

    const indisponibilidade=await tx.indisponibilidadeProfissional.create({
      data:{
        profissionalId:req.params.id,
        inicio,
        fim,
        indeterminado:modo==='INDETERMINADA',
        motivo,
        ativo:true,
        createdBy:req.user.username,
      },
    });

    let updated=profissional;
    if(modo==='INDETERMINADA'){
      updated=await tx.profissional.update({
        where:{id:req.params.id},
        data:{ativo:false,updatedBy:req.user.username},
        include:withUser,
      });
    }

    const titulo=modo==='TEMPORARIA'?'Afastamento temporário de profissional':'Profissional inativado por tempo indeterminado';
    const periodo=modo==='TEMPORARIA'
      ? `${inicio.toLocaleDateString('pt-BR',{timeZone:'UTC'})} a ${fim.toLocaleDateString('pt-BR',{timeZone:'UTC'})}`
      : 'a partir de hoje';
    const mensagem=`${profissional.nome}: ${periodo}. ${afetadas.length} plantão(ões) removido(s) e pendente(s) de redistribuição.`;
    const alerta=await tx.alertaEscala.create({
      data:{
        profissionalId:req.params.id,
        titulo,
        mensagem,
        detalhes:{
          modo,
          dias:modo==='TEMPORARIA'?dias:null,
          inicio:inicio.toISOString(),
          fim:fim?.toISOString()||null,
          plantões:afetadas.map(x=>({
            data:x.data.toISOString(),
            turno:x.turno,
            departamento:x.departamento?.nome||null,
          })),
        },
      },
    });

    return {profissional:updated,indisponibilidade,escalasRemovidas:afetadas.length,alerta};
  });

  res.json(result);
});

router.post('/:id/reativar', checkPermission('profissionais','write'), async (req,res) => {
  const profissional = await prisma.$transaction(async tx=>{
    await tx.indisponibilidadeProfissional.updateMany({
      where:{profissionalId:req.params.id,ativo:true},
      data:{ativo:false,encerradoEm:new Date(),encerradoBy:req.user.username},
    });
    return tx.profissional.update({
      where:{id:req.params.id},
      data:{ativo:true,updatedBy:req.user.username},
      include:withUser,
    });
  });
  res.json(profissional);
});

// Compatibilidade com clientes anteriores.
router.delete('/:id', checkPermission('profissionais','delete'), async (req,res) => {
  await prisma.profissional.update({where:{id:req.params.id},data:{ativo:false,updatedBy:req.user.username}});
  res.status(204).end();
});

export default router;
