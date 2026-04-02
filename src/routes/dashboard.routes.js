const express = require('express');

const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { asyncHandler } = require('../middleware/asyncHandler');
const { getSummary, byCategory, monthlyTrend, recent } = require('../controllers/dashboard.controller');

const router = express.Router();

router.use(auth, requireRole('analyst', 'admin'));

router.get('/summary', asyncHandler(getSummary));
router.get('/by-category', asyncHandler(byCategory));
router.get('/monthly-trend', asyncHandler(monthlyTrend));
router.get('/recent', asyncHandler(recent));

module.exports = router;
