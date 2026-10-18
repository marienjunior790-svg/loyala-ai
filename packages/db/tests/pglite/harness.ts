import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

export const MIGRATIONS_DIR = join(__dirname, '../../../../supabase/migrations');

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_.*\.sql$/.test(f))
    .sort();
}

export function readMigration(file: string): string {
  return readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
}

export interface ReplayResult {
  db: PGlite;
  failed: string[];
}

export interface ReplayOptions {
  /** Add the legacy Prisma columns production still has (default true). */
  legacyClientColumns?: boolean;
}

/**
 * Fresh in-memory Postgres with the Supabase stub, replaying every migration
 * strictly before `stopBefore` (e.g. '040'). Failures are collected, not thrown.
 */
export async function replayMigrations(
  stopBefore: string,
  { legacyClientColumns = true }: ReplayOptions = {}
): Promise<ReplayResult> {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec('create extension if not exists pgcrypto;');
  await db.exec(readFileSync(join(__dirname, 'supabase-stub.sql'), 'utf8'));

  const failed: string[] = [];
  for (const file of migrationFiles()) {
    if (file.slice(0, 3) >= stopBefore) break;
    try {
      await db.exec(readMigration(file));
    } catch {
      failed.push(file.slice(0, 3));
    }
  }
  // Production shares its database with the legacy Prisma backend: clients keeps
  // nullable tenant_id / name columns, which the 011 sync trigger reads.
  if (legacyClientColumns) {
    await db.exec(
      'alter table public.clients add column if not exists tenant_id uuid, add column if not exists name text;'
    );
  }
  return { db, failed };
}

/** Runs `fn` as an authenticated Supabase user (RLS applies), then rolls back on error. */
export async function asUser<T>(
  db: PGlite,
  userId: string,
  fn: (tx: Transaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    await tx.exec('set local role authenticated');
    return fn(tx);
  });
}

export async function rows<T>(
  db: PGlite | Transaction,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await db.query<T>(sql, params);
  return res.rows;
}

export async function one<T>(db: PGlite | Transaction, sql: string, params: unknown[] = []): Promise<T> {
  const list = await rows<T>(db, sql, params);
  if (list.length !== 1) throw new Error(`Expected 1 row, got ${list.length}: ${sql}`);
  return list[0] as T;
}
