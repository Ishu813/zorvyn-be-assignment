const express = require('express');

const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { asyncHandler } = require('../middleware/asyncHandler');
const {
  listTransactionsValidators,
  transactionIdParamValidators,
  createTransactionValidators,
  updateTransactionValidators
} = require('../validators/transactions.validators');
const {
  listTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction
} = require('../controllers/transactions.controller');

const router = express.Router();

router.use(auth);

router.get('/', listTransactionsValidators, asyncHandler(listTransactions));
router.get('/:id', transactionIdParamValidators, asyncHandler(getTransactionById));
router.post('/', requireRole('admin'), createTransactionValidators, asyncHandler(createTransaction));
router.patch('/:id', requireRole('admin'), updateTransactionValidators, asyncHandler(updateTransaction));
router.delete('/:id', requireRole('admin'), transactionIdParamValidators, asyncHandler(deleteTransaction));

module.exports = router;
