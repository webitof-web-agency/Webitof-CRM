function normalizeLabelEntry(item, fallbackColor = '#64748b') {
  if (typeof item === 'string') {
    const label = item.trim();
    return label ? { value: label, label, color: fallbackColor } : null;
  }

  if (item && typeof item === 'object') {
    const label = String(item.label || item.value || '').trim();
    if (!label) return null;
    return {
      value: String(item.value || label).trim() || label,
      label,
      color: item.color || item.badgeColor || fallbackColor,
      state: item.state || 'open'
    };
  }

  return null;
}

export function normalizeSharedLabels(value) {
  const entries = [];

  const pushEntries = (items) => {
    (Array.isArray(items) ? items : []).forEach((item) => {
      const normalized = normalizeLabelEntry(item);
      if (normalized) entries.push(normalized);
    });
  };

  if (Array.isArray(value)) {
    pushEntries(value);
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((items) => pushEntries(items));
  } else if (typeof value === 'string' && value.trim()) {
    pushEntries(value.split(',').map((item) => item.trim()).filter(Boolean));
  }

  const seen = new Set();
  return entries.filter((item) => {
    const key = String(item.label || '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeSharedLabelOptions(baseOptions = [], selectedLabels = []) {
  const map = new Map(normalizeSharedLabels(baseOptions).map((item) => [String(item.value || item.label), item]));
  const labels = Array.isArray(selectedLabels)
    ? selectedLabels
    : typeof selectedLabels === 'string'
      ? selectedLabels.split(',')
      : [];

  labels.forEach((label) => {
    const value = String(label || '').trim();
    if (!value || map.has(value)) return;
    map.set(value, { value, label: value, color: '#64748b', state: 'open' });
  });

  return Array.from(map.values());
}

export function buildSharedLabelColorMap(value) {
  const map = new Map();
  normalizeSharedLabels(value).forEach((item) => {
    map.set(String(item.label || '').trim(), item.color || '#64748b');
  });
  return map;
}
