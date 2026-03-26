/**
 * Parse Elasticsearch cat `store.size` style strings (e.g. "1.2gb", "500kb") to bytes for sorting.
 */
export function parseStoreSizeToBytes(value) {
  if (value == null || value === "") return 0;
  const s = String(value).trim().toLowerCase().replace(/,/g, "");
  const m = s.match(/^([\d.]+)\s*((?:[kmgtp]i?b)|b)?$/);
  if (!m) return 0;
  const n = parseFloat(m[1], 10);
  if (Number.isNaN(n)) return 0;
  const unit = (m[2] || "b").replace(/ib$/i, "b");
  const mult = {
    b: 1,
    kb: 1024,
    mb: 1024 ** 2,
    gb: 1024 ** 3,
    tb: 1024 ** 4,
    pb: 1024 ** 5,
  };
  return n * (mult[unit] ?? 1);
}

export const HEALTH_ORDER = { green: 0, yellow: 1, red: 2 };

export function compareStrings(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}
