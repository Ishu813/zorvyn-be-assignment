const { pool } = require('../config/database');

function parsePositiveInt(value, { defaultValue, max }) {
  const n = Number(value);
  if (!Number.isFinite(n)) return defaultValue;
  const i = Math.floor(n);
  if (i < 1) return defaultValue;
  if (typeof max === 'number') return Math.min(i, max);
  return i;
}

function isYyyyMmDd(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function monthKey(date) {
  return date.toISOString().slice(0, 7);
}

function addMonths(d, count) {
  const copy = new Date(d.getTime());
  copy.setUTCMonth(copy.getUTCMonth() + count);
  return copy;
}

async function getSummary(req, res, next) {
  try {
    const from = isYyyyMmDd(req.query.from) ? req.query.from : null;
    const to = isYyyyMmDd(req.query.to) ? req.query.to : null;

    const where = ['is_deleted = 0'];
    const params = [];
    let n = 1;

    if (from) {
      where.push(`date >= $${n++}`);
      params.push(from);
    }
    if (to) {
      where.push(`date <= $${n++}`);
      params.push(to);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const { rows } = await pool.query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS "totalIncome",
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS "totalExpenses",
        COALESCE(COUNT(*), 0)::bigint AS "totalTransactions",
        COALESCE(SUM(CASE WHEN type = 'income' THEN 1 ELSE 0 END), 0)::bigint AS "incomeCount",
        COALESCE(SUM(CASE WHEN type = 'expense' THEN 1 ELSE 0 END), 0)::bigint AS "expenseCount"
      FROM transactions
      ${whereSql}
    `,
      params
    );

    const row = rows[0];
    const totalIncome = Number(row.totalIncome || 0);
    const totalExpenses = Number(row.totalExpenses || 0);

    return res.status(200).json({
      summary: {
        totalIncome,
        totalExpenses,
        netBalance: totalIncome - totalExpenses,
        totalTransactions: Number(row.totalTransactions || 0),
        incomeCount: Number(row.incomeCount || 0),
        expenseCount: Number(row.expenseCount || 0),
        dateRange: {
          from: from || null,
          to: to || null
        }
      }
    });
  } catch (err) {
    return next(err);
  }
}

async function byCategory(req, res, next) {
  try {
    const type = req.query.type;
    const from = isYyyyMmDd(req.query.from) ? req.query.from : null;
    const to = isYyyyMmDd(req.query.to) ? req.query.to : null;

    const where = ['is_deleted = 0'];
    const params = [];
    let n = 1;

    if (type === 'income' || type === 'expense') {
      where.push(`type = $${n++}`);
      params.push(type);
    }
    if (from) {
      where.push(`date >= $${n++}`);
      params.push(from);
    }
    if (to) {
      where.push(`date <= $${n++}`);
      params.push(to);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const { rows } = await pool.query(
      `
      SELECT category, type, COALESCE(SUM(amount), 0) AS total, COUNT(*)::bigint AS count
      FROM transactions
      ${whereSql}
      GROUP BY category, type
      ORDER BY total DESC, category ASC
    `,
      params
    );

    const totalsByType = rows.reduce(
      (acc, r) => {
        const t = r.type;
        acc[t] = (acc[t] || 0) + Number(r.total || 0);
        return acc;
      },
      { income: 0, expense: 0 }
    );

    const categories = rows.map((r) => {
      const total = Number(r.total || 0);
      const denom = totalsByType[r.type] || 0;
      const percentage = denom > 0 ? Number(((total / denom) * 100).toFixed(2)) : 0;

      return {
        category: r.category,
        type: r.type,
        total,
        count: Number(r.count || 0),
        percentage
      };
    });

    return res.status(200).json({ categories });
  } catch (err) {
    return next(err);
  }
}

async function monthlyTrend(req, res, next) {
  try {
    const months = parsePositiveInt(req.query.months, { defaultValue: 6, max: 24 });

    const now = new Date();
    const start = addMonths(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), -(months - 1));
    const endMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const monthKeys = [];
    for (let i = 0; i < months; i += 1) {
      monthKeys.push(monthKey(addMonths(start, i)));
    }

    const startKey = monthKeys[0];
    const endKey = monthKey(endMonth);

    const { rows } = await pool.query(
      `
      SELECT
        SUBSTRING(date FROM 1 FOR 7) AS month,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenses
      FROM transactions
      WHERE is_deleted = 0
        AND SUBSTRING(date FROM 1 FOR 7) >= $1
        AND SUBSTRING(date FROM 1 FOR 7) <= $2
      GROUP BY SUBSTRING(date FROM 1 FOR 7)
      ORDER BY month ASC
    `,
      [startKey, endKey]
    );

    const byMonth = new Map(rows.map((r) => [r.month, r]));

    const trend = monthKeys.map((m) => {
      const r = byMonth.get(m);
      const income = r ? Number(r.income || 0) : 0;
      const expenses = r ? Number(r.expenses || 0) : 0;
      return { month: m, income, expenses, net: income - expenses };
    });

    return res.status(200).json({ trend });
  } catch (err) {
    return next(err);
  }
}

async function recent(req, res, next) {
  try {
    const limit = parsePositiveInt(req.query.limit, { defaultValue: 10, max: 25 });

    const { rows } = await pool.query(
      `
      SELECT
        t.id,
        t.amount,
        t.type,
        t.category,
        t.date,
        t.notes,
        u.id AS created_by_id,
        u.name AS created_by_name
      FROM transactions t
      JOIN users u ON u.id = t.created_by
      WHERE t.is_deleted = 0
      ORDER BY t.date DESC, t.id DESC
      LIMIT $1
    `,
      [limit]
    );

    const recentRows = rows.map((r) => ({
      id: r.id,
      amount: r.amount != null ? Number(r.amount) : r.amount,
      type: r.type,
      category: r.category,
      date: r.date,
      notes: r.notes,
      created_by: { id: r.created_by_id, name: r.created_by_name }
    }));

    return res.status(200).json({ recent: recentRows });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getSummary, byCategory, monthlyTrend, recent };
