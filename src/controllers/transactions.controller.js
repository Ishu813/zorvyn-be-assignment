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

function mapTransactionRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    amount: row.amount != null ? Number(row.amount) : row.amount,
    type: row.type,
    category: row.category,
    date: row.date,
    notes: row.notes,
    created_by: {
      id: row.created_by_id,
      name: row.created_by_name
    },
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function listTransactions(req, res, next) {
  try {
    if (sendValidationErrors(req, res)) return;

    const where = ['t.is_deleted = 0'];
    const params = [];
    let n = 1;

    if (req.query.type) {
      where.push(`t.type = $${n++}`);
      params.push(req.query.type);
    }
    if (req.query.category) {
      where.push(`t.category = $${n++}`);
      params.push(String(req.query.category).trim());
    }
    if (req.query.from) {
      where.push(`t.date >= $${n++}`);
      params.push(req.query.from.slice(0, 10));
    }
    if (req.query.to) {
      where.push(`t.date <= $${n++}`);
      params.push(req.query.to.slice(0, 10));
    }
    if (typeof req.query.minAmount !== 'undefined') {
      where.push(`t.amount >= $${n++}`);
      params.push(Number(req.query.minAmount));
    }
    if (typeof req.query.maxAmount !== 'undefined') {
      where.push(`t.amount <= $${n++}`);
      params.push(Number(req.query.maxAmount));
    }

    const sortBy = req.query.sortBy || 'date';
    const sortOrder = (req.query.sortOrder || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const sortBySql = sortBy === 'amount' ? 't.amount' : sortBy === 'created_at' ? 't.created_at' : 't.date';

    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const offset = (Math.max(page, 1) - 1) * safeLimit;

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const totalRow = await pool.query(`SELECT COUNT(*)::bigint AS total FROM transactions t ${whereSql}`, params);

    const limitIdx = n++;
    const offsetIdx = n++;
    const rowsResult = await pool.query(
      `
      SELECT
        t.id,
        t.amount,
        t.type,
        t.category,
        t.date,
        t.notes,
        t.created_at,
        t.updated_at,
        u.id AS created_by_id,
        u.name AS created_by_name
      FROM transactions t
      JOIN users u ON u.id = t.created_by
      ${whereSql}
      ORDER BY ${sortBySql} ${sortOrder}, t.id ${sortOrder}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `,
      [...params, safeLimit, offset]
    );

    const transactions = rowsResult.rows.map((r) => {
      const mapped = mapTransactionRow(r);
      delete mapped.updated_at;
      return mapped;
    });

    const total = Number(totalRow.rows[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    return res.status(200).json({
      transactions,
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

async function getTransactionById(req, res, next) {
  try {
    if (sendValidationErrors(req, res)) return;

    const id = Number(req.params.id);
    const { rows } = await pool.query(
      `
      SELECT
        t.id,
        t.amount,
        t.type,
        t.category,
        t.date,
        t.notes,
        t.created_at,
        t.updated_at,
        u.id AS created_by_id,
        u.name AS created_by_name
      FROM transactions t
      JOIN users u ON u.id = t.created_by
      WHERE t.id = $1 AND t.is_deleted = 0
    `,
      [id]
    );

    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Transaction not found' });
    return res.status(200).json({ transaction: mapTransactionRow(row) });
  } catch (err) {
    return next(err);
  }
}

async function createTransaction(req, res, next) {
  try {
    if (sendValidationErrors(req, res)) return;

    const amount = Number(req.body.amount);
    const type = String(req.body.type);
    const category = String(req.body.category).trim();
    const date = String(req.body.date).slice(0, 10);
    const notes = typeof req.body.notes === 'undefined' ? null : String(req.body.notes);

    const insertResult = await pool.query(
      `
      INSERT INTO transactions (amount, type, category, date, notes, created_by, is_deleted, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, 0, NOW(), NOW())
      RETURNING id
    `,
      [amount, type, category, date, notes, req.user.id]
    );

    const newId = insertResult.rows[0].id;

    const { rows } = await pool.query(
      `
      SELECT
        t.id,
        t.amount,
        t.type,
        t.category,
        t.date,
        t.notes,
        t.created_at,
        t.updated_at,
        u.id AS created_by_id,
        u.name AS created_by_name
      FROM transactions t
      JOIN users u ON u.id = t.created_by
      WHERE t.id = $1
    `,
      [newId]
    );

    const transaction = mapTransactionRow(rows[0]);
    delete transaction.updated_at;

    return res.status(201).json({
      message: 'Transaction created successfully',
      transaction
    });
  } catch (err) {
    return next(err);
  }
}

async function updateTransaction(req, res, next) {
  try {
    if (sendValidationErrors(req, res)) return;

    const id = Number(req.params.id);
    const existing = await pool.query('SELECT id FROM transactions WHERE id = $1 AND is_deleted = 0', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Transaction not found' });

    const fields = [];
    const params = [];
    let n = 1;

    if (Object.prototype.hasOwnProperty.call(req.body, 'amount')) {
      fields.push(`amount = $${n++}`);
      params.push(Number(req.body.amount));
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'type')) {
      fields.push(`type = $${n++}`);
      params.push(String(req.body.type));
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'category')) {
      fields.push(`category = $${n++}`);
      params.push(String(req.body.category).trim());
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'date')) {
      fields.push(`date = $${n++}`);
      params.push(String(req.body.date).slice(0, 10));
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'notes')) {
      fields.push(`notes = $${n++}`);
      params.push(req.body.notes === null ? null : String(req.body.notes));
    }

    if (fields.length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: [{ field: 'body', message: 'At least one field must be provided' }]
      });
    }

    fields.push('updated_at = NOW()');
    const idIdx = n++;
    params.push(id);

    await pool.query(`UPDATE transactions SET ${fields.join(', ')} WHERE id = $${idIdx} AND is_deleted = 0`, params);

    const { rows } = await pool.query(
      `
      SELECT
        t.id,
        t.amount,
        t.type,
        t.category,
        t.date,
        t.notes,
        t.created_at,
        t.updated_at,
        u.id AS created_by_id,
        u.name AS created_by_name
      FROM transactions t
      JOIN users u ON u.id = t.created_by
      WHERE t.id = $1 AND t.is_deleted = 0
    `,
      [id]
    );

    const transaction = mapTransactionRow(rows[0]);

    return res.status(200).json({
      message: 'Transaction updated successfully',
      transaction: {
        id: transaction.id,
        amount: transaction.amount,
        type: transaction.type,
        category: transaction.category,
        date: transaction.date,
        notes: transaction.notes,
        updated_at: transaction.updated_at
      }
    });
  } catch (err) {
    return next(err);
  }
}

async function deleteTransaction(req, res, next) {
  try {
    if (sendValidationErrors(req, res)) return;

    const id = Number(req.params.id);
    const result = await pool.query(
      `UPDATE transactions SET is_deleted = 1, updated_at = NOW() WHERE id = $1 AND is_deleted = 0`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    return res.status(200).json({ message: 'Transaction deleted successfully' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction
};
