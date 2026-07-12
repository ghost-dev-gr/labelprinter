// flatten.js
// Turns a nested webhook JSON payload into flat "dot.path": value pairs,
// e.g. { event: { pulseName: 'Test Order 1' } } -> { 'event.pulseName': 'Test Order 1' }

export function flattenObject(obj, prefix = '') {
  const result = {};
  if (obj === null || obj === undefined) return result;

  if (typeof obj !== 'object' || Array.isArray(obj)) {
    result[prefix || 'value'] = obj;
    return result;
  }

  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flattenObject(val, path));
    } else {
      result[path] = val;
    }
  }

  return result;
}
