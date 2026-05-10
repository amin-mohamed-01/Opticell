/**
 * lib/db.ts — Backwards-compatible re-export
 * All new code should import from '@/lib/postgres' directly.
 * This file exists so existing imports of '@/lib/db' continue to work.
 */
export { getDb } from './postgres';
export { default } from './postgres';
