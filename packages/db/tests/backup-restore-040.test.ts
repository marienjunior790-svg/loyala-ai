import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { pgDump } from '@electric-sql/pglite-tools/pg_dump';
import { asUser, one, readMigration, replayMigrations, rows } from './pglite/harness';
import { AWA, DIEU, MIGRATION_040, ORG_A, ORG_B, USER_A, USER_B, seedLegacy } from './fixtures/legacy-seed';

/** Logical backup, as `pg_dump --no-owner` would produce it before a production migration. */
async function backup(db: PGlite): Promise<string> {
  const file = await pgDump({ pg: db, args: ['--no-owner'] });
  // pg_dump shares the PGlite session and leaves its read-only snapshot transaction open.
  await db.exec('rollback');
  await db.exec('reset all');
  return file.text();
}

/** Restores a dump into a brand-new database where only the Supabase roles exist. */
async function restore(dump: string): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
  `);
  // psql meta-commands (\restrict, \connect) are not SQL.
  await db.exec(dump.replace(/^\\.*$/gm, ''));
  // The dump sets search_path = '' and row_security = off for its own session; a new connection starts from defaults.
  await db.exec('reset all');
  return db;
}

type Fingerprint = Record<string, string>;

/** Row count + content hash per table, and the security surface (functions, grants, policies, triggers). */
async function fingerprint(db: PGlite): Promise<Fingerprint> {
  const tables = await rows<{ name: string }>(
    db,
    `select format('%I.%I', schemaname, tablename) as name from pg_tables
     where schemaname in ('public', 'auth', 'storage') order by 1`
  );
  const out: Fingerprint = {};
  for (const { name } of tables) {
    const r = await one<{ n: number; h: string }>(
      db,
      `select count(*)::int as n, md5(coalesce(string_agg(t::text, '|' order by t::text), '')) as h from ${name} t`
    );
    out[name] = `${r.n}:${r.h}`;
  }
  const surface = await one<Fingerprint>(
    db,
    `select
       (select string_agg(line, E'\\n' order by line) from (
          select format('%s(%s) definer=%s acl=%s', p.proname, pg_get_function_identity_arguments(p.oid),
                        p.prosecdef, coalesce(p.proacl::text, '-')) as line
          from pg_proc p where p.pronamespace = 'public'::regnamespace) f) as functions,
       (select string_agg(line, E'\\n' order by line) from (
          select format('%s acl=%s rls=%s', c.relname, coalesce(c.relacl::text, '-'), c.relrowsecurity) as line
          from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v')) r) as relations,
       (select string_agg(line, E'\\n' order by line) from (
          select format('%s.%s %s roles=%s using=%s check=%s', tablename, policyname, cmd, roles, qual, with_check) as line
          from pg_policies where schemaname = 'public') p) as policies,
       (select string_agg(line, E'\\n' order by line) from (
          select format('%s.%s.%s enabled=%s', n.nspname, c.relname, t.tgname, t.tgenabled) as line
          from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
          where not t.tgisinternal) t) as triggers,
       (select string_agg(line, E'\\n' order by line) from (
          select format('%s validated=%s %s', conname, convalidated, pg_get_constraintdef(oid)) as line
          from pg_constraint where connamespace = 'public'::regnamespace) c) as constraints`
  );
  return { ...out, ...surface };
}

describe('sauvegarde et restauration isolées (pg_dump → base neuve)', () => {
  let source: PGlite;
  let preDump: string;
  let preFingerprint: Fingerprint;
  const restored: PGlite[] = [];

  beforeAll(async () => {
    source = (await replayMigrations('040')).db;
    await seedLegacy(source);
    preFingerprint = await fingerprint(source);
    preDump = await backup(source);
  }, 180_000);

  afterAll(async () => {
    await Promise.all([source, ...restored].map((db) => db?.close()));
  });

  it('restaure la sauvegarde d’avant migration à l’identique (données, droits, règles RLS)', async () => {
    expect(preDump).toMatch(/CREATE TABLE public\.client_visits/);
    const copy = await restore(preDump);
    restored.push(copy);
    const after = await fingerprint(copy);
    expect(Object.keys(after)).toEqual(Object.keys(preFingerprint));
    expect(after).toEqual(preFingerprint);
    expect(after['public.client_visits']).toMatch(/^5:/);
    expect(after['public.loyalty_transactions']).toMatch(/^5:/);
  }, 180_000);

  describe('après la migration 040', () => {
    let postFingerprint: Fingerprint;
    let postDump: string;

    beforeAll(async () => {
      await source.exec(readMigration(MIGRATION_040));
      await asUser(source, USER_A, (tx) =>
        tx.query(`select record_client_order($1, $2, now(), 'sur_place', 'cash', null, 4000, 0, null)`, [ORG_A, AWA])
      );
      postFingerprint = await fingerprint(source);
      postDump = await backup(source);
    }, 180_000);

    it('une sauvegarde prise après 040 se restaure avec fonctions, droits et isolation intacts', async () => {
      const copy = await restore(postDump);
      restored.push(copy);
      expect(await fingerprint(copy)).toEqual(postFingerprint);

      await asUser(copy, USER_A, (tx) =>
        tx.query(`select record_client_order($1, $2, now(), 'sur_place', 'wave', null, 2000, 0, null)`, [ORG_A, AWA])
      );
      expect(
        await asUser(copy, USER_B, (tx) => rows(tx, 'select id from clients where organization_id = $1', [ORG_A]))
      ).toEqual([]);
      await expect(
        asUser(copy, USER_B, (tx) =>
          tx.query(`select adjust_loyalty_points($1, $2, 100, 'test')`, [ORG_A, AWA])
        )
      ).rejects.toThrow(/Action non autorisée/);
      await expect(
        asUser(copy, USER_A, (tx) =>
          tx.query(`insert into loyalty_transactions (organization_id, client_id, points_delta, reason) values ($1, $2, 100, 'x')`, [
            ORG_A,
            AWA,
          ])
        )
      ).rejects.toThrow(/permission denied/);
    }, 180_000);

    it('retour arrière par restauration : état d’avant 040 exact, activité postérieure perdue', async () => {
      const rollback = await restore(preDump);
      restored.push(rollback);
      expect(postFingerprint).not.toEqual(preFingerprint);
      expect(await fingerprint(rollback)).toEqual(preFingerprint);

      const legacyColumn = await rows(
        rollback,
        `select 1 from information_schema.columns where table_name = 'client_visits' and column_name = 'legacy_kind'`
      );
      expect(legacyColumn).toEqual([]);
      const count = async (db: PGlite) =>
        (await one<{ n: number }>(db, 'select count(*)::int as n from client_visits')).n;
      expect(await count(source)).toBe(6);
      expect(await count(rollback)).toBe(5);
    }, 180_000);

    it('revenir à l’ancien code sans restaurer la base casse l’enregistrement des passages', async () => {
      await expect(
        asUser(source, USER_A, (tx) =>
          tx.query(`insert into client_visits (organization_id, client_id, kind, amount) values ($1, $2, 'visit', 1000)`, [
            ORG_A,
            AWA,
          ])
        )
      ).rejects.toThrow(/permission denied/);
      await expect(
        asUser(source, USER_A, (tx) => tx.query('delete from client_visits where organization_id = $1', [ORG_A]))
      ).rejects.toThrow(/permission denied/);
      await expect(
        asUser(source, USER_B, (tx) =>
          tx.query(`insert into loyalty_transactions (organization_id, client_id, points_delta, reason) values ($1, $2, 5, 'x')`, [
            ORG_B,
            DIEU,
          ])
        )
      ).rejects.toThrow(/permission denied/);
    });
  });
});
