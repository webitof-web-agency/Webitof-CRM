const express = require('express');
const controller = require('../controllers/projects.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requirePermission('projects.read'), controller.list);
router.post('/', requirePermission('projects.write'), controller.create);
router.get('/:id/summary', requirePermission('projects.read'), controller.summary);
router.get('/:id', requirePermission('projects.read'), controller.getById);
router.put('/:id', requirePermission('projects.write'), controller.update);
router.delete('/:id', requirePermission('projects.delete'), controller.remove);

module.exports = router;
