const { loadBusinessState } = require('../services/analytics.service');
const {
  buildBankReconciliation,
  buildFinanceLedger,
  buildFinanceSummary
} = require('../services/finance.service');

async function summary(req, res, next) {
  try {
    const state = await loadBusinessState();
    res.json({
      success: true,
      data: buildFinanceSummary(state)
    });
  } catch (error) {
    next(error);
  }
}

async function ledger(req, res, next) {
  try {
    const state = await loadBusinessState();
    const result = buildFinanceLedger(state, req.query || {});
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function reconciliation(req, res, next) {
  try {
    const state = await loadBusinessState();
    const result = buildBankReconciliation(state, req.query || {});
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  ledger,
  reconciliation,
  summary
};
