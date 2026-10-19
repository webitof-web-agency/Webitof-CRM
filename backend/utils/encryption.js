const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const VERSION = 1;

function getKey() {
  const raw = String(process.env.SETTINGS_ENCRYPTION_KEY || '').trim();
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    const error = new Error('SETTINGS_ENCRYPTION_KEY must be 64 hex characters (openssl rand -hex 32).');
    error.statusCode = 500;
    error.expose = true;
    throw error;
  }
  return Buffer.from(raw, 'hex');
}

function hasEncryptionKey() {
  return /^[0-9a-fA-F]{64}$/.test(String(process.env.SETTINGS_ENCRYPTION_KEY || '').trim());
}

function encrypt(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  return {
    version: VERSION,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64')
  };
}

function decrypt(envelope) {
  if (!envelope || envelope.version !== VERSION) {
    throw new Error('Unsupported encrypted value');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

module.exports = {
  decrypt,
  encrypt,
  hasEncryptionKey,
  sha256
};
