const express = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const todos = require('../services/todo.service');

// Every signed-in user manages their own todos; todos.view_all is checked inside the service.
const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const result = await todos.listTodos(req.query || {}, req.user);
  res.json({ success: true, data: result.rows, counts: result.counts, view: result.view, canViewAll: result.canViewAll });
}));

router.get('/options', (req, res) => {
  res.json({ success: true, data: { statuses: todos.STATUSES, priorities: todos.PRIORITIES, views: todos.VIEWS } });
});

router.get('/:id', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await todos.getTodo(req.params.id, req.user) });
}));

router.post('/', asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await todos.createTodo(req.body || {}, req.user) });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await todos.updateTodo(req.params.id, req.body || {}, req.user) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await todos.deleteTodo(req.params.id, req.user) });
}));

module.exports = router;
