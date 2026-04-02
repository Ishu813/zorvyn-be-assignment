const express = require('express');

const { auth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');
const { registerValidators, loginValidators } = require('../validators/auth.validators');
const { register, login, me } = require('../controllers/auth.controller');

const router = express.Router();

router.post('/register', registerValidators, asyncHandler(register));
router.post('/login', loginValidators, asyncHandler(login));
router.get('/me', auth, asyncHandler(me));

module.exports = router;
