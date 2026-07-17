const {
  createPasswordResetRequest,
  getUserAccessProfile,
  login,
  resetPasswordWithOtp
} = require('../services/auth.service');
const userModel = require('../models/user.model');
const { deleteFile } = require('../services/driveStorage.service');

async function loginController(req, res, next) {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'identifier and password are required' });
    }
    const result = await login({ identifier, password });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function meController(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const profile = await getUserAccessProfile(userId);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
}

async function forgotPasswordController(req, res, next) {
  try {
    const { identifier } = req.body || {};
    if (!identifier) {
      return res.status(400).json({ success: false, message: 'identifier is required' });
    }

    const result = await createPasswordResetRequest(identifier, {
      ip: req.ip,
      userAgent: req.headers['user-agent'] || ''
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function resetPasswordController(req, res, next) {
  try {
    const { identifier, otp, password, confirmPassword } = req.body || {};
    if (!identifier || !otp || !password) {
      return res.status(400).json({ success: false, message: 'identifier, otp and password are required' });
    }
    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'password and confirmPassword must match' });
    }

    const result = await resetPasswordWithOtp(
      { identifier, otp, password },
      {
        requestedAt: new Date().toISOString()
      }
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function updateProfileController(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

    const currentUser = await userModel.findById(userId);
    const { fullName, phone, address, avatarUrl, avatarFileId } = req.body || {};
    
    const patch = {};
    if (fullName !== undefined) patch.fullName = fullName;
    if (phone !== undefined) patch.phone = phone;
    if (address !== undefined) patch.address = address;
    if (avatarUrl !== undefined) patch.avatarUrl = avatarUrl;
    if (avatarFileId !== undefined) patch.avatarFileId = avatarFileId;

    const updatedUser = await userModel.update(userId, patch);
    if (!updatedUser) return res.status(404).json({ success: false, message: 'User not found' });

    if (currentUser?.avatarFileId && avatarFileId && String(currentUser.avatarFileId) !== String(avatarFileId)) {
      await deleteFile(currentUser.avatarFileId);
    }

    const profile = await getUserAccessProfile(userId);
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
}

async function deleteAvatarController(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

    const user = await userModel.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.avatarFileId) {
      await deleteFile(user.avatarFileId);
    }

    await userModel.update(userId, { avatarUrl: null, avatarFileId: null });
    const profile = await getUserAccessProfile(userId);
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  forgotPasswordController,
  loginController,
  meController,
  resetPasswordController,
  updateProfileController,
  deleteAvatarController
};
