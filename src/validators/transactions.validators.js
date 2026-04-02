const { body, query, param } = require('express-validator');

const listTransactionsValidators = [
  query('type').optional().isIn(['income', 'expense']).withMessage('Type must be income or expense'),
  query('category').optional().isString().withMessage('Category must be a string').trim(),
  query('from')
    .optional()
    .isISO8601({ strict: true })
    .withMessage('From must be a valid ISO date')
    .bail()
    .isLength({ min: 10, max: 10 })
    .withMessage('From must be in YYYY-MM-DD format'),
  query('to')
    .optional()
    .isISO8601({ strict: true })
    .withMessage('To must be a valid ISO date')
    .bail()
    .isLength({ min: 10, max: 10 })
    .withMessage('To must be in YYYY-MM-DD format'),
  query('minAmount').optional().isFloat({ min: 0 }).withMessage('minAmount must be >= 0').toFloat(),
  query('maxAmount').optional().isFloat({ min: 0 }).withMessage('maxAmount must be >= 0').toFloat(),
  query('sortBy')
    .optional()
    .isIn(['date', 'amount', 'created_at'])
    .withMessage('sortBy must be one of date, amount, created_at'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('sortOrder must be asc or desc'),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100').toInt()
];

const transactionIdParamValidators = [
  param('id').isInt({ min: 1 }).withMessage('Transaction id must be a positive integer').toInt()
];

const createTransactionValidators = [
  body('amount')
    .exists({ values: 'falsy' })
    .withMessage('Amount is required')
    .bail()
    .isFloat({ gt: 0 })
    .withMessage('Amount must be a positive number greater than 0')
    .toFloat(),
  body('type')
    .exists({ values: 'falsy' })
    .withMessage('Type is required')
    .bail()
    .isIn(['income', 'expense'])
    .withMessage('Type must be income or expense'),
  body('category')
    .exists({ values: 'falsy' })
    .withMessage('Category is required')
    .bail()
    .isString()
    .withMessage('Category must be a string')
    .bail()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Category must be between 1 and 100 characters'),
  body('date')
    .exists({ values: 'falsy' })
    .withMessage('Date is required')
    .bail()
    .isISO8601({ strict: true })
    .withMessage('Date must be a valid ISO date')
    .bail()
    .isLength({ min: 10, max: 10 })
    .withMessage('Date must be in YYYY-MM-DD format'),
  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string')
    .bail()
    .isLength({ max: 500 })
    .withMessage('Notes must be at most 500 characters')
];

const updateTransactionValidators = [
  ...transactionIdParamValidators,
  body('amount').optional().isFloat({ gt: 0 }).withMessage('Amount must be > 0').toFloat(),
  body('type').optional().isIn(['income', 'expense']).withMessage('Type must be income or expense'),
  body('category')
    .optional()
    .isString()
    .withMessage('Category must be a string')
    .bail()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Category must be between 1 and 100 characters'),
  body('date')
    .optional()
    .isISO8601({ strict: true })
    .withMessage('Date must be a valid ISO date')
    .bail()
    .isLength({ min: 10, max: 10 })
    .withMessage('Date must be in YYYY-MM-DD format'),
  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string')
    .bail()
    .isLength({ max: 500 })
    .withMessage('Notes must be at most 500 characters')
];

module.exports = {
  listTransactionsValidators,
  transactionIdParamValidators,
  createTransactionValidators,
  updateTransactionValidators
};

