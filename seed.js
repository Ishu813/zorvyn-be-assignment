require('dotenv').config();

const bcrypt = require('bcryptjs');
const { pool, initDb } = require('./src/config/database');

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function formatYyyyMmDd(d) {
  return d.toISOString().slice(0, 10);
}

function subtractMonths(date, months) {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

function randomDateInLastMonths(monthsBack) {
  const now = new Date();
  const start = subtractMonths(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
    monthsBack
  );
  const startMs = start.getTime();
  const endMs = now.getTime();
  const ms = randomInt(startMs, endMs);
  return new Date(ms);
}

async function seed() {
  await initDb();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE transactions, users RESTART IDENTITY CASCADE');

    const adminRes = await client.query(
      `
      INSERT INTO users (name, email, password, role, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
      RETURNING id
    `,
      ['Admin User', 'admin@demo.com', bcrypt.hashSync('Admin@123', 10), 'admin']
    );
    const adminId = adminRes.rows[0].id;

    await client.query(
      `
      INSERT INTO users (name, email, password, role, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
    `,
      ['Analyst User', 'analyst@demo.com', bcrypt.hashSync('Analyst@123', 10), 'analyst']
    );

    await client.query(
      `
      INSERT INTO users (name, email, password, role, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
    `,
      ['Viewer User', 'viewer@demo.com', bcrypt.hashSync('Viewer@123', 10), 'viewer']
    );

    const incomeCategories = ['salary', 'freelance'];
    const expenseCategories = [
      'rent',
      'food',
      'utilities',
      'transport',
      'entertainment',
      'health',
      'education',
      'office supplies'
    ];

    const totalTransactions = 36;
    for (let i = 0; i < totalTransactions; i += 1) {
      const type = Math.random() < 0.35 ? 'income' : 'expense';
      const category = type === 'income' ? pick(incomeCategories) : pick(expenseCategories);

      const amount =
        type === 'income'
          ? Number((randomInt(2000, 8000) + Math.random()).toFixed(2))
          : Number((randomInt(10, 1500) + Math.random()).toFixed(2));

      const date = formatYyyyMmDd(randomDateInLastMonths(6));
      let notes = null;
      if (type === 'income') {
        notes = category === 'salary' ? 'Monthly salary' : 'Freelance payout';
      }

      await client.query(
        `
        INSERT INTO transactions (amount, type, category, date, notes, created_by, is_deleted, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, 0, NOW(), NOW())
      `,
        [amount, type, category, date, notes, adminId]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log('Seed completed successfully.\n');
  console.log('Demo credentials:');
  console.log('- Admin:   admin@demo.com   / Admin@123');
  console.log('- Analyst: analyst@demo.com / Analyst@123');
  console.log('- Viewer:  viewer@demo.com  / Viewer@123');

  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
