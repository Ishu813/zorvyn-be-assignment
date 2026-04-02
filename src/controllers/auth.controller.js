const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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

async function register(req, res, next) {
  try {
    if (sendValidationErrors(req, res)) return;

    const name = String(req.body.name).trim();
    const email = String(req.body.email).trim().toLowerCase();
    const password = String(req.body.password);
    const role = req.body.role ? String(req.body.role) : 'viewer';

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows[0]) {
      return res.status(409).json({
        error: 'Email already exists',
        details: [{ field: 'email', message: 'Email already in use' }]
      });
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    try {
      const { rows } = await pool.query(
        `
        INSERT INTO users (name, email, password, role, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
        RETURNING id, name, email, role, status
      `,
        [name, email, passwordHash, role]
      );

      return res.status(201).json({
        message: 'User registered successfully',
        user: rows[0]
      });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({
          error: 'Email already exists',
          details: [{ field: 'email', message: 'Email already in use' }]
        });
      }
      throw err;
    }
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    if (sendValidationErrors(req, res)) return;

    const email = String(req.body.email).trim().toLowerCase();
    const password = String(req.body.password);

    const { rows } = await pool.query(
      `
      SELECT id, name, email, password, role, status
      FROM users
      WHERE email = $1
    `,
      [email]
    );

    const userRow = rows[0];
    if (!userRow) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (userRow.status !== 'active') {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    const ok = bcrypt.compareSync(password, userRow.password);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: userRow.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: userRow.id,
        name: userRow.name,
        email: userRow.email,
        role: userRow.role,
        status: userRow.status
      }
    });
  } catch (err) {
    return next(err);
  }
}

async function me(req, res, next) {
  try {
    const { rows } = await pool.query(
      `
      SELECT id, name, email, role, status, created_at
      FROM users
      WHERE id = $1
    `,
      [req.user.id]
    );

    return res.status(200).json({ user: rows[0] });
  } catch (err) {
    return next(err);
  }
}

module.exports = { register, login, me };
