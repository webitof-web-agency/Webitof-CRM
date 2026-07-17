const { createCrudController } = require('./crudController');
const clientContactModel = require('../models/clientContact.model');

const controller = createCrudController(clientContactModel, {
  defaultOrder: 'is_primary DESC, updated_at DESC'
});

controller.remove = async (req, res, next) => {
  try {
    const current = await clientContactModel.findById(req.params.id);
    if (!current) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    const ok = await clientContactModel.remove(req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    if (current.isPrimary) {
      const remaining = await clientContactModel.list({
        where: { clientId: current.clientId },
        orderBy: 'created_at ASC'
      });
      if (remaining[0]) {
        await clientContactModel.update(remaining[0].id, { isPrimary: true });
      }
    }

    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = controller;
