// Endpoint Serverless Vercel: /api/admin-users
// Gestión administrativa centralizada de usuarios en Supabase Auth
// Utiliza SUPABASE_SERVICE_ROLE_KEY (Server-only) con email_confirm: true

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://bfsnrpgdvvdkryzykcfn.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  if (!SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body != null) {
      if (typeof req.body === 'object') return resolve(req.body);
      try {
        return resolve(JSON.parse(req.body));
      } catch (err) {
        return reject(new Error('JSON malformado en body'));
      }
    }
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) req.destroy();
    });
    req.on('end', () => {
      if (!data.trim()) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error('JSON malformado'));
      }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  // CORS Headers para consumo seguro
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        error: 'SUPABASE_SERVICE_ROLE_KEY no configurada en el entorno del servidor',
        code: 'SERVICE_KEY_MISSING',
      })
    );
  }

  try {
    // 1. GET: Listar usuarios registrados en Supabase Auth
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers();
      if (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: error.message }));
      }

      const sanitizedUsers = (data?.users || []).map((u) => ({
        id: u.id,
        email: u.email,
        nombre: u.user_metadata?.nombre || u.email.split('@')[0],
        rol: u.user_metadata?.rol || 'taller_produccion',
        activo: u.user_metadata?.activo !== false,
        fecha_creacion: u.created_at,
        ultimo_ingreso: u.last_sign_in_at,
        email_confirmed: !!u.email_confirmed_at,
      }));

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: true, users: sanitizedUsers }));
    }

    // 2. POST: Operaciones administrativas (crear, editar, resetear clave, eliminar)
    if (req.method === 'POST') {
      const body = await parseBody(req);
      const action = body.action || 'create';

      // Acción: CREAR O ACTUALIZAR USUARIO
      if (action === 'create') {
        const cleanEmail = String(body.email || '').trim().toLowerCase();
        const cleanNombre = String(body.nombre || '').trim();
        const rawPassword = String(body.password || '').trim();
        const cleanRol = String(body.rol || 'taller_produccion').trim();
        const activo = body.activo !== false;

        if (!cleanEmail || !cleanEmail.includes('@')) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Correo electrónico inválido' }));
        }

        if (!cleanNombre) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Nombre de colaborador es requerido' }));
        }

        if (!rawPassword || rawPassword.length < 8) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'La contraseña debe tener al menos 8 caracteres' }));
        }

        // Primero verificamos si ya existe en Supabase Auth
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = (listData?.users || []).find(
          (u) => u.email?.toLowerCase() === cleanEmail
        );

        if (existingUser) {
          // Si ya existe, actualizamos contraseña y metadatos
          const { data: updated, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            existingUser.id,
            {
              password: rawPassword,
              email_confirm: true,
              user_metadata: {
                ...existingUser.user_metadata,
                nombre: cleanNombre,
                rol: cleanRol,
                activo,
              },
            }
          );

          if (updateError) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: updateError.message }));
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          return res.end(
            JSON.stringify({
              success: true,
              updated: true,
              user: {
                id: updated.user.id,
                email: updated.user.email,
                nombre: cleanNombre,
                rol: cleanRol,
                activo,
              },
            })
          );
        }

        // Crear nuevo usuario confirmado sin requerir confirmación por email
        const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          password: rawPassword,
          email_confirm: true,
          user_metadata: {
            nombre: cleanNombre,
            rol: cleanRol,
            activo,
          },
        });

        if (createError) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: createError.message }));
        }

        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json');
        return res.end(
          JSON.stringify({
            success: true,
            created: true,
            user: {
              id: created.user.id,
              email: created.user.email,
              nombre: cleanNombre,
              rol: cleanRol,
              activo,
            },
          })
        );
      }

      // Acción: RESETEO DE CONTRASEÑA POR ADMINISTRADOR
      if (action === 'reset-password') {
        const userId = body.userId;
        const cleanEmail = String(body.email || '').trim().toLowerCase();
        const newPassword = String(body.newPassword || '').trim();

        if (!newPassword || newPassword.length < 8) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'La nueva contraseña debe tener al menos 8 caracteres' }));
        }

        let targetId = userId;
        if (!targetId && cleanEmail) {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
          const target = (listData?.users || []).find((u) => u.email?.toLowerCase() === cleanEmail);
          if (target) targetId = target.id;
        }

        if (!targetId) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Usuario no encontrado en Supabase Auth' }));
        }

        const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(targetId, {
          password: newPassword,
          email_confirm: true,
        });

        if (resetError) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: resetError.message }));
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ success: true, message: 'Contraseña actualizada en Supabase Auth' }));
      }

      // Acción: ELIMINAR USUARIO
      if (action === 'delete') {
        const userId = body.userId;
        const cleanEmail = String(body.email || '').trim().toLowerCase();

        let targetId = userId;
        if (!targetId && cleanEmail) {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
          const target = (listData?.users || []).find((u) => u.email?.toLowerCase() === cleanEmail);
          if (target) targetId = target.id;
        }

        if (targetId) {
          await supabaseAdmin.auth.admin.deleteUser(targetId);
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ success: true }));
      }

      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: `Acción '${action}' no reconocida` }));
    }

    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Método HTTP no permitido' }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: err.message || 'Error interno del servidor' }));
  }
}
