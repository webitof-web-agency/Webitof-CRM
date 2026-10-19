const asyncHandler = require('../middlewares/asyncHandler');
const storage = require('../services/storage/storage.service');

const get = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await storage.getStorageSettings() });
});

const update = asyncHandler(async (req, res) => {
  const activeProvider = String(req.body?.activeProvider || '').trim().toLowerCase();
  res.json({ success: true, data: await storage.setActiveProvider(activeProvider) });
});

const test = asyncHandler(async (req, res) => {
  const provider = String(req.body?.provider || '').trim().toLowerCase() || undefined;
  try {
    res.json({ success: true, data: await storage.testProvider(provider) });
  } catch (error) {
    res.status(error.statusCode && error.statusCode < 500 ? error.statusCode : 502).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = {
  get,
  test,
  update
};
