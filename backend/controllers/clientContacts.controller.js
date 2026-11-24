const { createCrudController } = require('./crudController');
const clientContactModel = require('../models/clientContact.model');
const clientModel = require('../models/client.model');
const { canAccessClient, filterClientsByAccess, userCanViewAllClients } = require('../services/clientAccess.service');
const { hiddenAdminIds } = require('../services/adminPrivacy.service');

// Nothing to check when the user sees every client and no Super Admin clients are hidden.
const seesEveryClient = (user) => userCanViewAllClients(user) && !hiddenAdminIds(user).length;

// Contacts follow their client: a user without clients.view_all reaches only the contacts of
// clients they are assigned to or manage.
async function canReachClient(user, clientId) {
  if (seesEveryClient(user)) return true;
  const client = clientId ? await clientModel.findById(clientId) : null;
  return canAccessClient(user, client);
}

const notFound = (res) => res.status(404).json({ success: false, message: 'Record not found' });

const controller = createCrudController(clientContactModel, {
  defaultOrder: 'is_primary DESC, updated_at DESC',
  onList: async (rows, req) => {
    if (seesEveryClient(req.user)) return rows;
    const reachable = new Set(filterClientsByAccess(await clientModel.list(), req.user).map((client) => String(client.id)));
    return rows.filter((row) => reachable.has(String(row.clientId)));
  }
});

async function findReachableContact(id, user) {
  const contact = await clientContactModel.findById(id);
  return contact && (await canReachClient(user, contact.clientId)) ? contact : null;
}

const crudGet = controller.getById;
const crudCreate = controller.create;
const crudUpdate = controller.update;

controller.getById = async (req, res, next) => {
  try {
    if (!(await findReachableContact(req.params.id, req.user))) return notFound(res);
    return crudGet(req, res, next);
  } catch (error) {
    next(error);
  }
};

controller.create = async (req, res, next) => {
  try {
    if (!(await canReachClient(req.user, req.body?.clientId))) return notFound(res);
    return crudCreate(req, res, next);
  } catch (error) {
    next(error);
  }
};

controller.update = async (req, res, next) => {
  try {
    if (!(await findReachableContact(req.params.id, req.user))) return notFound(res);
    if (req.body?.clientId && !(await canReachClient(req.user, req.body.clientId))) return notFound(res);
    return crudUpdate(req, res, next);
  } catch (error) {
    next(error);
  }
};

controller.remove = async (req, res, next) => {
  try {
    const current = await findReachableContact(req.params.id, req.user);
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
