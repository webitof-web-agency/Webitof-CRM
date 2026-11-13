const { query } = require('../config/db');

// Limiter for the public auth endpoints. By default it counts failed responses only, so a user
// who logs in correctly is never slowed down; countAll also counts successes, for endpoints such
// as forgot-password where every success sends an email. The key combines IP and the submitted
// login, which still works behind a reverse proxy where every request shares the proxy IP.
// Counters live in Postgres (auth_rate_limits) so they survive restarts and are shared by every
// API instance; if the table is unavailable the limiter falls back to process memory.
// ipOnly keys on the caller's IP alone, for public endpoints with no login (e.g. the lead webhook).
function failedAttemptLimiter({ name = 'auth', windowMs = 15 * 60 * 1000, max = 10, message, countAll = false, ipOnly = false } = {}) {
  const memory = new Map();
  const windowSeconds = Math.ceil(windowMs / 1000);

  const store = {
    // Counts the attempt up front and returns the new total, so parallel requests cannot all
    // slip through before an earlier failure is recorded.
    async hit(key) {
      try {
        const result = await query(
          `INSERT INTO auth_rate_limits (key, count, reset_at) VALUES ($1, 1, now() + make_interval(secs => $2))
           ON CONFLICT (key) DO UPDATE SET
             count = CASE WHEN auth_rate_limits.reset_at <= now() THEN 1 ELSE auth_rate_limits.count + 1 END,
             reset_at = CASE WHEN auth_rate_limits.reset_at <= now() THEN EXCLUDED.reset_at ELSE auth_rate_limits.reset_at END
           RETURNING count, extract(epoch FROM reset_at) * 1000 AS reset_ms`,
          [key, windowSeconds]
        );
        if (Math.random() < 0.02) {
          query(`DELETE FROM auth_rate_limits WHERE reset_at < now() - interval '1 day'`).catch(() => {});
        }
        return { count: Number(result.rows[0].count), resetAt: Number(result.rows[0].reset_ms) };
      } catch {
        let current = memory.get(key);
        if (!current || current.resetAt <= Date.now()) {
          if (memory.size > 5000) memory.clear();
          current = { count: 0, resetAt: Date.now() + windowMs };
          memory.set(key, current);
        }
        current.count += 1;
        return current;
      }
    },
    async reset(key) {
      memory.delete(key);
      try {
        await query('DELETE FROM auth_rate_limits WHERE key = $1', [key]);
      } catch {
        // memory entry already cleared
      }
    }
  };

  return async (req, res, next) => {
    const identifier = ipOnly ? '' : String(req.body?.identifier || req.body?.email || req.body?.username || '').trim().toLowerCase();
    const key = `${name}|${req.ip}|${identifier}`;
    const entry = await store.hit(key);

    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        success: false,
        message: message || `Too many failed attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`
      });
    }

    // A successful login clears the counter, so only failures add up.
    res.on('finish', () => {
      if (res.statusCode < 400 && !countAll) store.reset(key).catch(() => {});
    });

    return next();
  };
}

module.exports = { failedAttemptLimiter };
