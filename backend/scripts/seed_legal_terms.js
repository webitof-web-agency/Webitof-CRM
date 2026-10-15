const { query } = require('../config/db');
const { DEFAULT_LEGAL_TERMS } = require('../database/defaultData');

async function main() {
  for (const it of DEFAULT_LEGAL_TERMS) {
    const existing = await query('SELECT id FROM master_items WHERE type = $1 AND name = $2', [it.type, it.name]);
    if (existing.rows.length === 0) {
      await query(
        'INSERT INTO master_items (id, type, name, is_active, sort_order, payload) VALUES ($1, $2, $3, $4, $5, $6)',
        [it.id, it.type, it.name, it.is_active, it.sort_order, it.payload]
      );
      console.log('Inserted:', it.name);
    } else {
      await query(
        'UPDATE master_items SET payload = $1, is_active = $2, sort_order = $3 WHERE id = $4',
        [it.payload, it.is_active, it.sort_order, existing.rows[0].id]
      );
      console.log('Updated:', it.name);
    }
  }
  const result = await query("SELECT id, type, name, payload FROM master_items WHERE type = 'legal_term'");
  console.log('Total legal terms in DB:', result.rows.length);
  result.rows.forEach(r => console.log(' -', r.name, '| isDefault:', r.payload?.isDefault));
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
