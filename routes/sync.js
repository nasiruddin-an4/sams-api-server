const express = require('express');
const { getSyncData } = require('../controllers/syncController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', getSyncData);

module.exports = router;
