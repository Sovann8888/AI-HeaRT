/**
 * Normalizes Cambodian phone numbers to a single canonical E.164-ish form
 * (+855XXXXXXXXX) so "012 345 678", "855012345678", and "+855 12 345 678"
 * all resolve to the same account instead of registering 3 separate ones.
 */
function normalizePhone(raw) {
  if (typeof raw !== "string") return null;

  // Strip everything except digits and a leading +
  let s = raw.trim().replace(/[^\d+]/g, "");

  if (s.startsWith("+855")) {
    s = s.slice(4);
  } else if (s.startsWith("855")) {
    s = s.slice(3);
  } else if (s.startsWith("0")) {
    s = s.slice(1);
  } else {
    // Unrecognized prefix — reject rather than guess
    return null;
  }

  // Cambodian mobile numbers are 8-9 digits after the country code/leading 0
  if (!/^\d{8,9}$/.test(s)) return null;

  return `+855${s}`;
}

module.exports = { normalizePhone };
