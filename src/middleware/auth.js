const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { asyncHandler } = require('./asyncHandler');

const auth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let userId;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userId = decoded && decoded.id;
  } catch (_err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { rows } = await pool.query(
    `
    SELECT id, name, email, role, status, created_at, updated_at
    FROM users
    WHERE id = $1
  `,
    [userId]
  );

  const user = rows[0];
  if (!user || user.status !== 'active') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = user;
  return next();
});

module.exports = { auth };
