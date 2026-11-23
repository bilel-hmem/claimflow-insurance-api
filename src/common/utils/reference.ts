import { randomBytes } from 'node:crypto';

/** Human-friendly public number, e.g. CLM-20261123-4F2A9C. Unique index in the DB. */
export function generateNumber(prefix: 'CLM' | 'POL', now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${day}-${randomBytes(3).toString('hex').toUpperCase()}`;
}
