const express = require('express');
const {
  forgotPasswordController,
  loginController,
  meController,
  resetPasswordController,
  updateProfileController,
  deleteAvatarController
} = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth');
const { failedAttemptLimiter } = require('../middlewares/rateLimit');

const router = express.Router();
const loginLimiter = failedAttemptLimiter({ name: 'login', max: 10 });
const resetLimiter = failedAttemptLimiter({ name: 'reset', max: 5 });
const otpRequestLimiter = failedAttemptLimiter({ name: 'otp-request', max: 3, countAll: true, message: 'Too many reset requests. Please wait 15 minutes before asking for a new code.' });

router.post('/login', loginLimiter, loginController);
router.post('/forgot-password', otpRequestLimiter, forgotPasswordController);
router.post('/reset-password', resetLimiter, resetPasswordController);
router.get('/me', requireAuth, meController);
router.patch('/profile', requireAuth, updateProfileController);
router.delete('/avatar', requireAuth, deleteAvatarController);

module.exports = router;
