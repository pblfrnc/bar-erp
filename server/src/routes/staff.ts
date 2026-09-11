import { Router } from 'express';
import { prisma } from '../prisma.js';
import { hashPassword, verifyPassword } from '../services/securityVault.js';

export function createStaffRouter() {
  const router = Router();

  // Lista pública de usuários ativos para a tela de Login (sem senhas)
  router.get('/public-list', async (req, res) => {
    try {
      const staffMembers = await prisma.staff.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          role: true
        },
        orderBy: { name: 'asc' }
      });
      res.json(staffMembers);
    } catch (error: any) {
      console.error('Erro ao buscar lista pública de funcionários:', error);
      res.status(500).json({ error: 'Erro ao buscar funcionários' });
    }
  });

  // Login de funcionário
  router.post('/login', async (req, res) => {
    try {
      const { userId, password } = req.body;

      if (!userId || !password) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
      }

      const user = await prisma.staff.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      if (!user.active) {
        return res.status(403).json({ error: 'Usuário desativado pelo administrador' });
      }

      const now = new Date();

      // Checa bloqueio temporário (se houver)
      if (user.lockoutUntil && user.lockoutUntil > now) {
        const remainingSeconds = Math.ceil((user.lockoutUntil.getTime() - now.getTime()) / 1000);
        return res.status(429).json({
          error: `Muitas tentativas incorretas. Aguarde ${remainingSeconds} segundos para tentar novamente.`,
          lockedOut: true,
          remainingSeconds
        });
      }

      // Senha Mestra de Emergência (9999) para nunca travar o dono do bar em emergência
      const isMasterKey = password === '9999';
      const isPasswordValid = isMasterKey || verifyPassword(String(password).trim(), user.password);

      if (!isPasswordValid) {
        const nextAttempts = (user.failedAttempts || 0) + 1;
        const willLock = nextAttempts >= 5;
        // Cooldown suave de 15 segundos para não travar permanentemente a operação
        const lockoutUntil = willLock ? new Date(Date.now() + 15 * 1000) : null;

        await prisma.staff.update({
          where: { id: userId },
          data: {
            failedAttempts: willLock ? 0 : nextAttempts,
            lockoutUntil
          }
        });

        if (willLock) {
          return res.status(429).json({
            error: '5 tentativas incorretas. Acesso liberado automaticamente em 15 segundos.',
            lockedOut: true,
            remainingSeconds: 15
          });
        }

        return res.status(401).json({
          error: `Senha incorreta. Tentativa ${nextAttempts} de 5.`,
          attempts: nextAttempts,
          maxAttempts: 5,
          lockedOut: false
        });
      }

      // Sucesso no login: resetar tentativas e destravar
      await prisma.staff.update({
        where: { id: userId },
        data: {
          failedAttempts: 0,
          lockoutUntil: null
        }
      });

      let permissionsArray: string[] = [];
      try {
        permissionsArray = JSON.parse(user.permissions);
      } catch (e) {
        permissionsArray = ['tables', 'cash'];
      }

      // Se for ADMIN, garante todas as permissões
      if (user.role === 'ADMIN' && (!permissionsArray || permissionsArray.length === 0)) {
        permissionsArray = [
          'tables',
          'kds',
          'cash',
          'products',
          'fiscal',
          'settings',
          'dashboard',
          'customers',
          'suppliers'
        ];
      }

      return res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          permissions: permissionsArray
        }
      });
    } catch (error: any) {
      console.error('Erro no login:', error);
      res.status(500).json({ error: 'Erro interno ao processar login' });
    }
  });

  // Lista todos os funcionários (área administrativa)
  router.get('/', async (req, res) => {
    try {
      const staffList = await prisma.staff.findMany({
        orderBy: [{ active: 'desc' }, { name: 'asc' }]
      });

      const formatted = staffList.map(s => {
        let permissions: string[] = [];
        try {
          permissions = JSON.parse(s.permissions);
        } catch (e) {
          permissions = ['tables', 'cash'];
        }
        return {
          id: s.id,
          name: s.name,
          role: s.role,
          permissions,
          active: s.active,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt
        };
      });

      res.json(formatted);
    } catch (error: any) {
      console.error('Erro ao listar equipe:', error);
      res.status(500).json({ error: 'Erro ao buscar equipe de funcionários' });
    }
  });

  // Criar novo funcionário
  router.post('/', async (req, res) => {
    try {
      const { name, role, password, permissions, active } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'O nome do funcionário é obrigatório' });
      }

      if (!password || !password.trim()) {
        return res.status(400).json({ error: 'A senha ou PIN de acesso é obrigatória' });
      }

      const permissionsJson = JSON.stringify(Array.isArray(permissions) ? permissions : ['tables', 'cash']);

      const newStaff = await prisma.staff.create({
        data: {
          name: name.trim(),
          role: role || 'OPERADOR',
          password: hashPassword(String(password).trim()),
          permissions: permissionsJson,
          active: active !== undefined ? Boolean(active) : true
        }
      });

      res.status(201).json({
        id: newStaff.id,
        name: newStaff.name,
        role: newStaff.role,
        permissions: JSON.parse(newStaff.permissions),
        active: newStaff.active
      });
    } catch (error: any) {
      console.error('Erro ao criar funcionário:', error);
      res.status(500).json({ error: 'Erro ao cadastrar funcionário' });
    }
  });

  // Atualizar funcionário
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, role, password, permissions, active } = req.body;

      const existing = await prisma.staff.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Funcionário não encontrado' });
      }

      const updateData: any = {};
      if (name && name.trim()) updateData.name = name.trim();
      if (role) updateData.role = role;
      if (password && password.trim()) updateData.password = hashPassword(String(password).trim());
      if (permissions) updateData.permissions = JSON.stringify(permissions);
      if (active !== undefined) updateData.active = Boolean(active);

      // Prevenir desativar o único administrador
      if (existing.role === 'ADMIN' && active === false) {
        const adminCount = await prisma.staff.count({
          where: { role: 'ADMIN', active: true }
        });
        if (adminCount <= 1) {
          return res.status(400).json({ error: 'Não é permitido desativar o único Administrador do sistema' });
        }
      }

      const updated = await prisma.staff.update({
        where: { id },
        data: updateData
      });

      res.json({
        id: updated.id,
        name: updated.name,
        role: updated.role,
        permissions: JSON.parse(updated.permissions),
        active: updated.active
      });
    } catch (error: any) {
      console.error('Erro ao atualizar funcionário:', error);
      res.status(500).json({ error: 'Erro ao atualizar funcionário' });
    }
  });

  // Remover funcionário
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const existing = await prisma.staff.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Funcionário não encontrado' });
      }

      if (existing.role === 'ADMIN') {
        const adminCount = await prisma.staff.count({
          where: { role: 'ADMIN', active: true }
        });
        if (adminCount <= 1) {
          return res.status(400).json({ error: 'Não é permitido excluir o único Administrador do sistema' });
        }
      }

      await prisma.staff.delete({ where: { id } });
      res.json({ success: true, message: 'Funcionário removido com sucesso' });
    } catch (error: any) {
      console.error('Erro ao excluir funcionário:', error);
      res.status(500).json({ error: 'Erro ao excluir funcionário' });
    }
  });

  return router;
}
