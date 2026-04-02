const { validationResult } = require('express-validator');
const { pool } = require('../config/database');

function sendValidationErrors(req, res) {
  const result = validationResult(req);
  if (result.isEmpty()) return false;

  const details = result.array().map((e) => ({
    field: e.param,
    message: e.msg
  }));

  res.status(400).json({ error: 'Validation failed', details });
  return true;
}

async function listUsers(req, res, next) {
  try {
    if (sendValidationErrors(req, res)) return;

    const status = req.query.status;
    const role = req.query.role;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const offset = (Math.max(page, 1) - 1) * safeLimit;

    let n = 1;
    const where = [];
    const params = [];

    if (status) {
      where.push(`status = $${n++}`);
      params.push(status);
    }
    if (role) {
      where.push(`role = $${n++}`);
      params.push(role);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*)::bigint AS total FROM users ${whereSql}`,
      params
    );

    const limitIdx = n++;
    const offsetIdx = n++;
    const usersResult = await pool.query(
      `
      SELECT id, name, email, role, status, created_at
      FROM users
      ${whereSql}
      ORDER BY id ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `,
      [...params, safeLimit, offset]
    );

    const total = Number(countResult.rows[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    return res.status(200).json({
      users: usersResult.rows,
      pagination: {
        total,
        page: Math.max(page, 1),
        limit: safeLimit,
        totalPages
      }
    });
  } catch (err) {
    return next(err);
  }
}

async function getUserById(req, res, next) {
  try {
    if (sendValidationErrors(req, res)) return;

    const id = Number(req.params.id);
    const { rows } = await pool.query(
      `
      SELECT id, name, email, role, status, created_at
      FROM users
      WHERE id = $1
    `,
      [id]
    );

    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json({ user });
  } catch (err) {
    return next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    if (sendValidationErrors(req, res)) return;

    const targetId = Number(req.params.id);
    if (req.user && req.user.id === targetId) {
      const changingRole = Object.prototype.hasOwnProperty.call(req.body, 'role');
      const changingStatus = Object.prototype.hasOwnProperty.call(req.body, 'status');
      if (changingRole || changingStatus) {
        return res.status(403).json({ error: 'You cannot modify your own role or status' });
      }
    }

    const existing = await pool.query('SELECT id FROM users WHERE id = $1', [targetId]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'User not found' });

    const fields = [];
    const params = [];
    let n = 1;

    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
      fields.push(`name = $${n++}`);
      params.push(String(req.body.name).trim());
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'role')) {
      fields.push(`role = $${n++}`);
      params.push(String(req.body.role));
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'status')) {
      fields.push(`status = $${n++}`);
      params.push(String(req.body.status));
    }

    if (fields.length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: [{ field: 'body', message: 'At least one field must be provided' }]
      });
    }

    fields.push('updated_at = NOW()');
    const idIdx = n++;
    params.push(targetId);

    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idIdx}`, params);

    const { rows } = await pool.query(
      `
      SELECT id, name, email, role, status
      FROM users
      WHERE id = $1
    `,
      [targetId]
    );

    return res.status(200).json({ message: 'User updated successfully', user: rows[0] });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listUsers, getUserById, updateUser };
