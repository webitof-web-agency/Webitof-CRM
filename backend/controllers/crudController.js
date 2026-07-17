function createCrudController(model, options = {}) {
  const defaultOrder = options.defaultOrder || 'updated_at DESC';

  return {
    list: async (req, res, next) => {
      try {
        const { search, limit, offset, orderBy, ...filters } = req.query || {};
        let rows = await model.list({
          where: filters,
          search,
          orderBy: orderBy || defaultOrder
        });

        if (typeof options.onList === 'function') {
          rows = await options.onList(rows, req);
        }

        if (limit || offset) {
          const start = Number(offset || 0);
          const end = limit ? start + Number(limit) : undefined;
          rows = rows.slice(start, end);
        }

        res.json({ success: true, data: rows });
      } catch (error) {
        next(error);
      }
    },

    getById: async (req, res, next) => {
      try {
        const record = await model.findById(req.params.id);
        if (!record) {
          return res.status(404).json({ success: false, message: 'Record not found' });
        }
        res.json({ success: true, data: record });
      } catch (error) {
        next(error);
      }
    },

    create: async (req, res, next) => {
      try {
        const body = typeof options.onCreate === 'function'
          ? await options.onCreate(req.body || {}, req)
          : (req.body || {});
        const record = await model.create(body);
        res.status(201).json({ success: true, data: record });
      } catch (error) {
        next(error);
      }
    },

    update: async (req, res, next) => {
      try {
        const current = await model.findById(req.params.id);
        if (!current) {
          return res.status(404).json({ success: false, message: 'Record not found' });
        }
        const body = typeof options.onUpdate === 'function'
          ? await options.onUpdate(req.body || {}, req, current)
          : (req.body || {});
        const record = await model.update(req.params.id, body);
        res.json({ success: true, data: record });
      } catch (error) {
        next(error);
      }
    },

    remove: async (req, res, next) => {
      try {
        const ok = await model.remove(req.params.id);
        if (!ok) {
          return res.status(404).json({ success: false, message: 'Record not found' });
        }
        res.json({ success: true, message: 'Deleted successfully' });
      } catch (error) {
        next(error);
      }
    }
  };
}

module.exports = {
  createCrudController
};
