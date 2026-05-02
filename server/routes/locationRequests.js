const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/locationRequestController');

router.post('/', protect, ctrl.create);
router.get('/mine', protect, ctrl.listMine);

module.exports = router;
