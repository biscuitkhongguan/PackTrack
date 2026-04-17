/**
 * Scanner validation logic — ported from packing-time-tracker
 */

/** Default bin regex: accepts any alphanumeric bin ID */
export const DEFAULT_BIN_REGEX = '^[A-Z0-9][A-Z0-9_\\-]{1,48}$';

/**
 * Normalizes a raw scan value:
 * - Trims and uppercases
 * - Strips invisible control characters
 * - Multi-Scan Guard: if scanner accidentally fires same code 2-4x, collapses it
 */
export function normalizeScan(input: string): string {
  if (!input) return '';
  let clean = input.trim().toUpperCase().replace(/[\x00-\x1F\x7F]/g, '');

  // Detect repeated scans of same code (common scanner hardware bug)
  for (let n = 4; n >= 2; n--) {
    if (clean.length % n === 0) {
      const chunkLen = clean.length / n;
      if (chunkLen > 3) {
        const chunk = clean.substring(0, chunkLen);
        let isRepeated = true;
        for (let i = 1; i < n; i++) {
          if (clean.substring(i * chunkLen, (i + 1) * chunkLen) !== chunk) {
            isRepeated = false;
            break;
          }
        }
        if (isRepeated) {
          console.log(`[Multi-Scan Guard] ${n}x repeat detected: "${chunk}"`);
          return chunk;
        }
      }
    }
  }
  return clean;
}

/** Validates a bin ID against a configurable regex */
export function validateBinFormat(input: string, customRegex?: string): boolean {
  try {
    return new RegExp(customRegex || DEFAULT_BIN_REGEX).test(input);
  } catch {
    return false;
  }
}

/**
 * Order regex: 8-50 chars, alphanumeric + hyphen + underscore
 * Supports standard formats AND instant/sameday (e.g. 3M_SO69A91CD6C9E77C000131F2AA-1)
 */
export function validateOrderFormat(input: string): boolean {
  return /^[A-Z0-9][A-Z0-9_\-]{6,48}[A-Z0-9]$/.test(input);
}

/**
 * Detects SLA tier from order ID:
 * - length > 25 chars → Instant / Same-day
 * - otherwise → Regular
 */
export function detectSla(orderId: string): 'Regular' | 'Instant' {
  return orderId.length > 25 ? 'Instant' : 'Regular';
}

/** Checks if today's completed sessions already contain this order ID (duplicate guard) */
export function isDuplicateOrder(orderId: string, sessions: any[]): boolean {
  const today = new Date().toISOString().split('T')[0];
  return sessions.some(
    s => s.order_id === orderId && s.status === 'COMPLETED' && s.date === today
  );
}
