import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, one, readMigration, replayMigrations } from './pglite/harness';

const MIGRATION_041 = '041_fix_clients_legacy_sync_trigger.sql';
const ORG = 'cccccccc-0000-4000-8000-000000000001';
const OWNER = 'cccccccc-0000-4000-8000-0000000000a1';

async function seedOrg(db: PGlite): Promise<void> {
  await db.exec(`
    insert into auth.users (id, email) values ('${OWNER}', 'gerant@test.local');
    insert into organizations (id, slug, name, country_code, timezone, currency)
      values ('${ORG}', 'resto-neuf', 'Restaurant neuf', 'CG', 'Africa/Brazzaville', 'XAF');
    insert into organization_members (organization_id, user_id, role_id, status)
      select '${ORG}', '${OWNER}', id, 'active' from roles where scope = 'organization' and code = 'org_owner';
  `);
}

const insertClient = (db: PGlite, name: string) =>
  asUser(db, OWNER, (tx) =>
    one<{ id: string; phone_e164: string }>(
      tx,
      `insert into clients (organization_id, full_name, phone) values ($1, $2, '06 123 45 67') returning id, phone_e164`,
      [ORG, name]
    )
  );

describe('installation neuve (sans colonnes Prisma héritées)', () => {
  let db: PGlite;
  let failed: string[];

  beforeAll(async () => {
    const replay = await replayMigrations('041', { legacyClientColumns: false });
    db = replay.db;
    failed = replay.failed;
    await seedOrg(db);
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it('applique 040 sur une base neuve', () => {
    expect(failed).not.toContain('040');
  });

  it('avant 041 : la création d’un client échoue (déclencheur 011)', async () => {
    await expect(insertClient(db, 'Avant correctif')).rejects.toThrow(/has no field "tenant_id"/);
  });

  it('après 041 : création, modification et commande fonctionnent', async () => {
    await db.exec(readMigration(MIGRATION_041));
    const created = await insertClient(db, 'Après correctif');
    expect(created.phone_e164).toBe('+242061234567');

    await asUser(db, OWNER, (tx) => tx.query(`update clients set notes = 'ok' where id = $1`, [created.id]));
    const order = await asUser(db, OWNER, (tx) =>
      one<{ r: { points_delta: number } }>(
        tx,
        `select record_client_order($1, $2, now(), 'sur_place', 'cash', null, 3000, 0, null) as r`,
        [ORG, created.id]
      )
    );
    expect(order.r.points_delta).toBe(3);
    const client = await one<{ loyalty_points: number; visit_count: number }>(
      db,
      'select loyalty_points, visit_count from clients where id = $1',
      [created.id]
    );
    expect(client).toEqual({ loyalty_points: 3, visit_count: 1 });
  });
});

describe('base de production (colonnes Prisma héritées) : 041 ne change rien', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = (await replayMigrations('041')).db;
    await seedOrg(db);
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  const legacyInsert = (db: PGlite, id: string) =>
    db.query(
      `insert into clients (id, organization_id, tenant_id, name, full_name, phone)
       values ($1, null, $2, 'Nom Prisma', null, $3)`,
      [id, ORG, `05 555 ${id.slice(-4)}`]
    );
  const read = (db: PGlite, id: string) =>
    one<{ organization_id: string; full_name: string }>(
      db,
      'select organization_id, full_name from clients where id = $1',
      [id]
    );

  it('recopie tenant_id et name comme le déclencheur 011, avant et après 041', async () => {
    const before = 'cccccccc-0000-4000-8000-0000000000c1';
    const after = 'cccccccc-0000-4000-8000-0000000000c2';
    await legacyInsert(db, before);
    await db.exec(readMigration(MIGRATION_041));
    await legacyInsert(db, after);
    const expected = { organization_id: ORG, full_name: 'Nom Prisma' };
    expect(await read(db, before)).toEqual(expected);
    expect(await read(db, after)).toEqual(expected);
  });

  it('laisse les fiches sans tenant_id inchangées', async () => {
    const created = await insertClient(db, 'Client Loyala');
    expect(await read(db, created.id)).toEqual({ organization_id: ORG, full_name: 'Client Loyala' });
  });
});
