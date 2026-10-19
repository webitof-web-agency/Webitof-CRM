// Key + JSON payload store for system state (Drive connection, backup status, storage choice).
const { query } = require('../config/db');

const dbStore = {
  async get(key) {
    const result = await query('select payload from system_settings where key = $1', [key]);
    return result.rows[0]?.payload || null;
  },
  async set(key, payload) {
    await query(
      `insert into system_settings (key, payload, updated_at) values ($1, $2::jsonb, now())
       on conflict (key) do update set payload = excluded.payload, updated_at = now()`,
      [key, JSON.stringify(payload || {})]
    );
    return payload;
  }
};

let store = dbStore;

function setStoreForTests(nextStore) {
  store = nextStore || dbStore;
}

function createMemoryStore(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    async get(key) {
      return data.has(key) ? JSON.parse(JSON.stringify(data.get(key))) : null;
    },
    async set(key, payload) {
      data.set(key, JSON.parse(JSON.stringify(payload || {})));
      return payload;
    }
  };
}

async function getSetting(key, fallback = {}) {
  return (await store.get(key)) || fallback;
}

async function setSetting(key, payload) {
  return store.set(key, payload);
}

async function patchSetting(key, patch) {
  const current = await getSetting(key, {});
  const next = { ...current, ...patch };
  await setSetting(key, next);
  return next;
}

module.exports = {
  createMemoryStore,
  getSetting,
  patchSetting,
  setSetting,
  setStoreForTests
};
