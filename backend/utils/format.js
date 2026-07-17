const { randomUUID } = require('crypto');

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round2(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

function isTruthy(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (value == null) return false;
  const text = String(value).trim().toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(text);
}

function createId(prefix) {
  const clean = String(prefix || 'id').replace(/[^a-z0-9_-]/gi, '').toLowerCase();
  return `${clean}_${randomUUID().replace(/-/g, '')}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value) {
  if (value == null) return '';
  return String(value).trim();
}

function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function toSnakeCase(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

function toCamelCase(value) {
  return String(value).replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
}

module.exports = {
  createId,
  deepClone,
  isTruthy,
  normalizeText,
  nowIso,
  round2,
  toCamelCase,
  toNumber,
  toSnakeCase
};
