const { query, param, body } = require('express-validator');

const listUsersValidators = [
  query('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be active or inactive'),
  query('role')
    .optional()
    .isIn(['admin', 'analyst', 'viewer'])
    .withMessage('Role must be admin, analyst, or viewer'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be an integer >= 1')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be an integer between 1 and 50')
    .toInt()
];

const userIdParamValidators = [
  param('id').isInt({ min: 1 }).withMessage('User id must be a positive integer').toInt()
];

const updateUserValidators = [
  ...userIdParamValidators,
  body('role')
    .optional()
    .isIn(['admin', 'analyst', 'viewer'])
    .withMessage('Role must be one of viewer, analyst, admin'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be active or inactive'),
  body('name')
    .optional()
    .isString()
    .withMessage('Name must be a string')
    .bail()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters')
];

module.exports = {
  listUsersValidators,
  userIdParamValidators,
  updateUserValidators
};

