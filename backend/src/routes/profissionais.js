import { createRouter } from '../utils/asyncRouter.js';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissions.js';
import { assert, senhaForte } from '../utils/validation.js';

const router = createRouter();
router.use(authenticate);

const userSelect = { id:true, username:true, nome:true, cargo:true, role:true, permissoes:true, ativo:true };
const withUser = { usuario:{ select:userSelect } };

function requireAdminForAccess(req, acesso) {
  if (acesso !== undefined) assert(req.user?.role === 'ADMIN', 'Somente administrador pode alterar acesso ao sistema', 403);
}

async function ensureUsernameAvailable(tx, username, ignoreId) {
  const exists = await tx.usuario.findFirst({
    where: { username:{ equals:username, mode:'insensitive' }, ...(ignoreId ? { NOT:{ id:ignoreId } } : {}) },
  });
  assert(!exists, 'Username já cadastrado', 409, 'DUPLICATE_USERNAME');
}

router.get('/', checkPermission('profissionais','read'), async (req,res) => {
  const { search='', ativo } = req.query;
  const data = await prisma.profissional.findMany({
    where:{
      ...(ativo !== undefined && { ativo:ativo === 'true' }),
      ...(search && { OR:[
        { nome:{contains:search,mode:'insensitive'} },
        { registroConselho:{contains:search,mode:'insensitive'} },
        { cargo:{contains:search,mode:'insensitive'} },
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
  const inicioHoje = new Date();
  inicioHoje.setHours(0,0,0,0);
  const escalasFuturas = await prisma.escala.count({ where:{ profissionalId:req.params.id, data:{gte:inicioHoje} } });
  res.json({ escalasFuturas });
});

router.post('/', checkPermission('profissionais','write'), async (req,res) => {
  const { nome, registroConselho, cargo, acesso } = req.body;
  assert(nome && registroConselho && cargo, 'Nome, registro e cargo são obrigatórios');
  requireAdminForAccess(req, acesso);

  let passwordHash = null;
  if (acesso?.enabled) {
    assert(acesso.username, 'Usuário é obrigatório para conceder acesso');
    assert(senhaForte(acesso.password), 'Senha deve ter no mínimo 8 caracteres, com letra e número');
    passwordHash = await bcrypt.hash(acesso.password, 10);
  }

  const data = await prisma.$transaction(async tx => {
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
      data:{ nome:nome.trim(), registroConselho:registroConselho.trim(), cargo, usuarioId, updatedBy:req.user.username },
      include:withUser,
    });
  });

  res.status(201).json(data);
});

router.put('/:id', checkPermission('profissionais','write'), async (req,res) => {
  const { nome, registroConselho, cargo, ativo, acesso } = req.body;
  requireAdminForAccess(req, acesso);

  const current = await prisma.profissional.findUnique({ where:{id:req.params.id}, include:withUser });
  assert(current, 'Profissional não encontrado', 404);

  let passwordHash = null;
  if (acesso?.enabled && acesso.password) {
    assert(senhaForte(acesso.password), 'Senha deve ter no mínimo 8 caracteres, com letra e número');
    passwordHash = await bcrypt.hash(acesso.password, 10);
  }

  const result = await prisma.$transaction(async tx => {
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
        ...(usuarioId !== current.usuarioId && {usuarioId}),
        updatedBy:req.user.username,
      },
      include:withUser,
    });
  });

  res.json(result);
});

router.post('/:id/inativar', checkPermission('profissionais','delete'), async (req,res) => {
  const removerEscalasFuturas = req.body.removerEscalasFuturas === true;
  const inicioHoje = new Date();
  inicioHoje.setHours(0,0,0,0);

  const result = await prisma.$transaction(async tx => {
    const profissional = await tx.profissional.findUnique({ where:{id:req.params.id}, include:withUser });
    assert(profissional, 'Profissional não encontrado', 404);

    let removidas = 0;
    if (removerEscalasFuturas) {
      const deleted = await tx.escala.deleteMany({ where:{profissionalId:req.params.id, data:{gte:inicioHoje}} });
      removidas = deleted.count;
    }

    const updated = await tx.profissional.update({
      where:{id:req.params.id},
      data:{ativo:false,updatedBy:req.user.username},
      include:withUser,
    });
    return { profissional:updated, escalasRemovidas:removidas };
  });

  res.json(result);
});

router.post('/:id/reativar', checkPermission('profissionais','write'), async (req,res) => {
  const profissional = await prisma.profissional.update({
    where:{id:req.params.id},
    data:{ativo:true,updatedBy:req.user.username},
    include:withUser,
  });
  res.json(profissional);
});

// Compatibilidade com clientes anteriores: inativa sem remover escalas.
router.delete('/:id', checkPermission('profissionais','delete'), async (req,res) => {
  await prisma.profissional.update({where:{id:req.params.id},data:{ativo:false,updatedBy:req.user.username}});
  res.status(204).end();
});

export default router;
