const express = require('express');
const controller = require('../controllers/notifications.controller');

const router = express.Router();

router.get('/', controller.listController);
router.get('/unread-count', controller.unreadCountController);
router.patch('/read-all', controller.markAllReadController);
router.patch('/:id/read', controller.markReadController);

module.exports = router;
