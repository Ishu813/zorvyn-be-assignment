const express = require('express');

const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { asyncHandler } = require('../middleware/asyncHandler');
const {
  listUsersValidators,
  userIdParamValidators,
  updateUserValidators
} = require('../validators/users.validators');
const { listUsers, getUserById, updateUser } = require('../controllers/users.controller');

const router = express.Router();

router.use(auth, requireRole('admin'));

router.get('/', listUsersValidators, asyncHandler(listUsers));
router.get('/:id', userIdParamValidators, asyncHandler(getUserById));
router.patch('/:id', updateUserValidators, asyncHandler(updateUser));

module.exports = router;
