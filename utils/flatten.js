// flatten.js
// Turns a nested webhook JSON payload into flat "dot.path": value pairs,
// e.g. { event: { pulseName: 'Test Order 1' } } -> { 'event.pulseName': 'Test Order 1' }

const WEBHOOK_FIELD_PREFIX = 'webhook:';

// Fields imported from the Label Designer's "From Last Webhook" picker are stored with
// columnId like "webhook:event.groupId" (see LabelDesigner.jsx's importWebhookFields) so
// they can't collide with board column ids. flattenObject() keys are the raw path without
// that prefix, so strip it before looking a field's value up in a flattened payload.
export function webhookFlatKey(columnId) {
  return columnId.startsWith(WEBHOOK_FIELD_PREFIX)
    ? columnId.slice(WEBHOOK_FIELD_PREFIX.length)
    : columnId;
}

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
