require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { initDb } = require('./config/database');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const transactionsRoutes = require('./routes/transactions.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  return res.status(200).json({ message: 'Welcome to the Finance Dashboard API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use((req, res) => {
  return res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
});

const port = Number(process.env.PORT || 3000);

async function start() {
  await initDb();
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
