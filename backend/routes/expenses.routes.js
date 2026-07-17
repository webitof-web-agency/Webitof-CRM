const express = require('express');
const controller = require('../controllers/expenses.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requirePermission('expenses.read'), controller.list);
router.post('/', requirePermission('expenses.write'), controller.create);
router.get('/:id', requirePermission('expenses.read'), controller.getById);
router.put('/:id', requirePermission('expenses.write'), controller.update);
router.delete('/:id', requirePermission('expenses.delete'), controller.remove);

module.exports = router;
