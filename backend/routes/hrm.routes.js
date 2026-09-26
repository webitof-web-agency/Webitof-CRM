const express = require("express");
const multer = require("multer");
const { requirePermission } = require("../middlewares/auth");
const c = require("../controllers/hrm.controller");
const router = express.Router();
router.use(
  requirePermission(
    "hrm.view_own",
    "hrm.view_team",
    "hrm.view_projects",
    "hrm.view_all",
  ),
);
router.use((req, res, next) => {
  req.user = { ...req.user, hrmRequestIp: req.ip };
  next();
});
router.get("/meta", c.meta);
router.get("/lookups", c.lookups);
router.put("/policy", c.policy);
router.get("/dashboard", c.dashboard);
router.get("/analytics", c.analytics);
router.post("/automation/run", c.automation);
router.get("/employees", c.employees);
router.post("/employees", c.saveEmployee);
router.get("/employees/:id", c.employee);
router.put("/employees/:id", c.saveEmployee);
router.delete("/employees/:id", c.archiveEmployee);
router.get("/employees/:id/private", c.privateProfile);
router.put("/employees/:id/private", c.privateProfile);
router.get("/employees/:id/leave-balances", c.leaveBalance);
router.get("/employees/:id/letter", c.letter);
router.post("/employees/:id/offboard", c.offboard);
router.get("/resources/:kind", c.list);
router.post("/records/:kind", c.record);
router.put("/records/:kind/:id", c.record);
router.post("/candidates/:id/convert", c.convert);
router.post("/masters/:type", c.master);
router.put("/masters/:type/:id", c.master);
router.get("/holidays", c.holidays);
router.post("/holidays", c.holidays);
router.put("/holidays/:id", c.holidays);
router.post("/attendance/clock", c.clock);
router.post("/attendance/mark", c.markAttendance);
router.post("/leave-grants", c.grantLeave);
router.post("/requests", c.request);
router.put("/requests/:id", c.request);
router.post("/requests/:id/action", c.approveRequest);
router.get("/tasks", c.tasks);
router.post("/work-reports", c.saveReport);
router.get("/work-reports/:id", c.reportDetail);
router.put("/work-reports/:id", c.saveReport);
router.post("/work-reports/:id/action", c.reportAction);
router.post("/timesheets", c.timesheet);
router.post("/timesheets/:id/action", c.timesheet);
router.post("/allocations", c.allocation);
router.put("/allocations/:id", c.allocation);
router.post("/salary-history", c.salary);
router.get("/payroll", c.payroll);
router.post("/payroll", c.payrollDraft);
router.post("/payroll/:id/action", c.payrollAction);
router.get("/payslips/:id", c.payslip);
router.post(
  "/documents",
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10485760, files: 1, fields: 8 },
  }).single("file"),
  c.uploadDocument,
);
router.get("/documents/:id/download", c.downloadDocument);
router.post("/documents/:id/verify", c.verifyDocument);
router.get("/export/:kind", c.export);
module.exports = router;
