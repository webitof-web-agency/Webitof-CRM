const fs = require('fs');
const path = require('path');

function getRoot() {
  return path.resolve(process.env.LOCAL_STORAGE_DIR || path.join(__dirname, '..', '..', '..', 'uploads', 'files'));
}

// Resolves a storage key inside the root; refuses anything that escapes it.
function resolvePath(storageKey) {
  const root = getRoot();
  const target = path.resolve(root, String(storageKey || ''));
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error('Invalid storage key');
  }
  return target;
}

function parseRange(range, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(range || '').trim());
  if (!match || (!match[1] && !match[2])) return null;
  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  }
  if (start > end || start >= size) return null;
  return { start, end };
}

const localProvider = {
  name: 'local',

  async upload(buffer, storageKey) {
    const target = resolvePath(storageKey);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(target, buffer, { flag: 'wx' });
    return { storageProvider: 'local', storageKey, storageBucket: '' };
  },

  async open(locator, { range = '' } = {}) {
    let target;
    try {
      target = resolvePath(locator.storageKey);
    } catch {
      return null;
    }
    let stat;
    try {
      stat = await fs.promises.stat(target);
    } catch {
      return null;
    }
    if (!stat.isFile()) return null;
    const parsed = range ? parseRange(range, stat.size) : null;
    if (parsed) {
      return {
        status: 206,
        stream: fs.createReadStream(target, parsed),
        contentLength: parsed.end - parsed.start + 1,
        contentRange: `bytes ${parsed.start}-${parsed.end}/${stat.size}`
      };
    }
    return { status: 200, stream: fs.createReadStream(target), contentLength: stat.size, contentRange: '' };
  },

  async readBuffer(locator) {
    try {
      return await fs.promises.readFile(resolvePath(locator.storageKey));
    } catch {
      return null;
    }
  },

  async exists(locator) {
    try {
      return (await fs.promises.stat(resolvePath(locator.storageKey))).isFile();
    } catch {
      return false;
    }
  },

  async delete(locator) {
    try {
      await fs.promises.unlink(resolvePath(locator.storageKey));
    } catch {
      // Already gone.
    }
  },

  async rename() {
    // The display name lives in file_assets; the stored file keeps its key.
  },

  async testConnection() {
    const key = `.storage-test-${Date.now()}.txt`;
    const body = Buffer.from('ok');
    await localProvider.upload(body, key);
    const read = await localProvider.readBuffer({ storageKey: key });
    await localProvider.delete({ storageKey: key });
    if (!read || !read.equals(body)) throw new Error('Local storage read-back failed');
    return { ok: true, message: `Local storage is writable (${getRoot()})` };
  }
};

module.exports = {
  getRoot,
  localProvider,
  parseRange
};
