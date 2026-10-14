import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizePhoneE164 } from '@loyala/integrations/phone';
import { asUser, MIGRATIONS_DIR, one, readMigration, replayMigrations, rows } from './pglite/harness';
import {
  AWA,
  BARA,
  COUMBA,
  DIEU,
  MIGRATION_040,
  ORG_A,
  ORG_B,
  THIEB,
  USER_A,
  USER_B,
  V1,
  V2,
  V3,
  V4,
  V5,
  seedLegacy,
} from './fixtures/legacy-seed';

type OrderRow = {
  id: string;
  kind: string;
  legacy_kind: string | null;
  status: string;
  source: string;
  order_type: string;
  amount: string | null;
  subtotal: string;
  refunded_amount: string;
  visited_at: Date;
  updated_at: Date;
};

type ClientRow = {
  id: string;
  visit_count: number;
  total_spent: string;
  loyalty_points: number;
  last_visit_at: Date | null;
  opt_in_whatsapp: boolean;
  whatsapp_consent: string;
  whatsapp_consent_source: string | null;
  whatsapp_consent_at: Date | null;
  phone_e164: string | null;
  updated_at: Date;
};

async function client(db: PGlite, id: string): Promise<ClientRow> {
  return one<ClientRow>(db, 'select * from clients where id = $1', [id]);
}

async function order(db: PGlite, id: string): Promise<OrderRow> {
  return one<OrderRow>(db, 'select * from client_visits where id = $1', [id]);
}

describe('migration 040 — commandes, traçabilité, cloisonnement (base PGlite isolée)', () => {
  let db: PGlite;
  let failedBefore: string[];
  let before: { id: string; amount: string | null; visited_at: Date; updated_at: Date }[];

  beforeAll(async () => {
    const replay = await replayMigrations('040');
    db = replay.db;
    failedBefore = replay.failed;
    await seedLegacy(db);
    before = await rows(db, 'select id, amount, visited_at, updated_at from client_visits order by id');
    await db.exec(readMigration(MIGRATION_040));
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it('rejoue l’historique des migrations (écarts connus de la prod : 015, 018, 019)', () => {
    expect(failedBefore).toEqual(['015', '018', '019']);
  });

  describe('migration sans perte', () => {
    it('conserve chaque passage, sa date et son montant exact', async () => {
      const after = await rows<{ id: string; amount: string | null; visited_at: Date; updated_at: Date }>(
        db,
        'select id, amount, visited_at, updated_at from client_visits order by id'
      );
      expect(after).toHaveLength(before.length);
      expect(after.map((r) => [r.id, r.amount, r.visited_at.toISOString(), r.updated_at.toISOString()])).toEqual(
        before.map((r) => [r.id, r.amount, r.visited_at.toISOString(), r.updated_at.toISOString()])
      );
    });

    it('marque les anciens passages comme commandes payées « historique »', async () => {
      const v1 = await order(db, V1);
      expect(v1).toMatchObject({ status: 'paid', source: 'historique', kind: 'visit', legacy_kind: 'visit', order_type: 'sur_place' });
      expect(Number(v1.subtotal)).toBe(7000);
    });

    it('convertit les dépenses en commandes à emporter / livraison en gardant le type d’origine', async () => {
      const v2 = await order(db, V2);
      expect(v2).toMatchObject({ kind: 'visit', legacy_kind: 'expense', order_type: 'a_emporter', status: 'paid' });
      expect(Number(v2.amount)).toBe(12000);
    });

    it('garde le montant saisi même quand il diffère des lignes', async () => {
      const v4 = await order(db, V4);
      expect(Number(v4.amount)).toBe(25000);
      expect(Number(v4.subtotal)).toBe(25000);
      const items = await rows(db, 'select * from visit_items where visit_id = $1', [V4]);
      expect(items).toHaveLength(2);
    });

    it('recalcule les totaux clients avec les mêmes montants, dépenses comprises', async () => {
      const awa = await client(db, AWA);
      expect(Number(awa.total_spent)).toBe(19000);
      expect(awa.visit_count).toBe(3);
      expect(awa.last_visit_at?.toISOString()).toBe('2026-09-15T12:00:00.000Z');
      expect(Number((await client(db, BARA)).total_spent)).toBe(25000);
      expect(Number((await client(db, DIEU)).total_spent)).toBe(5000);
    });

    it('ne touche ni aux soldes de points ni aux dates de modification des clients', async () => {
      expect((await client(db, AWA)).loyalty_points).toBe(69);
      expect((await client(db, BARA)).loyalty_points).toBe(25);
      expect((await client(db, AWA)).updated_at.toISOString()).toBe('2026-08-01T10:00:00.000Z');
    });

    it('relie les points automatiques à leur passage seulement quand le lien est certain', async () => {
      const txs = await rows<{ reason: string; visit_id: string | null; kind: string }>(
        db,
        'select reason, visit_id, kind from loyalty_transactions where organization_id = $1 order by created_at',
        [ORG_A]
      );
      const byReason = Object.fromEntries(txs.map((t) => [t.reason, t]));
      expect(byReason['Visite automatique · 7 000 XOF → +7 pts']).toMatchObject({ visit_id: V1, kind: 'earn' });
      expect(byReason['Dépense automatique · 12 000 XOF → +12 pts']).toMatchObject({ visit_id: V2, kind: 'earn' });
      expect(byReason['Visite automatique · 25 000 XOF → +25 pts']).toMatchObject({ visit_id: null, kind: 'historique' });
      expect(byReason['Bonus anniversaire']).toMatchObject({ visit_id: null, kind: 'historique' });
    });

    it('garde les clients opt-in contactables, marqués « consentement à confirmer »', async () => {
      const awa = await client(db, AWA);
      expect(awa).toMatchObject({ whatsapp_consent: 'a_confirmer', whatsapp_consent_source: 'historique', opt_in_whatsapp: true });
      expect(awa.whatsapp_consent_at).toBeNull();
      expect(await client(db, BARA)).toMatchObject({ whatsapp_consent: 'refuse', opt_in_whatsapp: false });
      const events = await rows(db, 'select * from client_consent_events where client_id = $1', [AWA]);
      expect(events).toHaveLength(1);
    });

    it('trace la reprise de chaque passage dans l’historique des commandes', async () => {
      const events = await rows<{ order_id: string; event: string }>(
        db,
        "select order_id, event from client_order_events where event = 'migrated' order by order_id"
      );
      expect(events.map((e) => e.order_id).sort()).toEqual([V1, V2, V3, V4, V5].sort());
    });

    it('calcule le numéro international selon le pays du restaurant', async () => {
      expect((await client(db, AWA)).phone_e164).toBe('+221771234567');
      expect((await client(db, BARA)).phone_e164).toBe('+221760000001');
      expect((await client(db, DIEU)).phone_e164).toBe('+242061234567');
    });

    it('liste les doublons de téléphone sans les fusionner', async () => {
      const dups = await asUser(db, USER_A, (tx) =>
        rows<{ phone_e164: string; client_ids: string[] }>(tx, 'select phone_e164, client_ids from client_phone_duplicates')
      );
      expect(dups).toHaveLength(1);
      expect(dups[0]?.phone_e164).toBe('+221771234567');
      expect([...(dups[0]?.client_ids ?? [])].sort()).toEqual([AWA, COUMBA].sort());
      expect(await rows(db, 'select id from clients where id in ($1, $2)', [AWA, COUMBA])).toHaveLength(2);
    });

    it('peut être rejouée sans rien dupliquer ni modifier', async () => {
      const snapshot = async () => ({
        orders: await rows(db, 'select * from client_visits order by id'),
        clients: await rows(db, 'select * from clients order by id'),
        orderEvents: (await one<{ n: number }>(db, 'select count(*)::int n from client_order_events')).n,
        consentEvents: (await one<{ n: number }>(db, 'select count(*)::int n from client_consent_events')).n,
        points: await rows(db, 'select * from loyalty_transactions order by id'),
      });
      const first = await snapshot();
      await db.exec(readMigration(MIGRATION_040));
      expect(await snapshot()).toEqual(first);
    });
  });

  describe('enregistrement, modification, remboursement et annulation', () => {
    let newOrderId: string;

    it('enregistre une commande en une seule opération : lignes, remise, points, totaux, historique', async () => {
      const result = await asUser(db, USER_A, (tx) =>
        one<{ r: { order: { id: string; amount: number; subtotal: number }; points_delta: number } }>(
          tx,
          `select record_client_order($1, $2, '2026-10-12T13:00:00Z', 'sur_place', 'wave',
             $3::jsonb, null, 500, 'Table terrasse') as r`,
          [
            ORG_A,
            AWA,
            JSON.stringify([
              { catalog_item_id: THIEB, name: 'Thieboudienne', category_name: 'Plats', quantity: 2, unit_price: 3500 },
              { name: 'Bissap', category_name: 'Boissons', quantity: 1, unit_price: 1000 },
            ]),
          ]
        )
      );
      newOrderId = result.r.order.id;
      expect(Number(result.r.order.subtotal)).toBe(8000);
      expect(Number(result.r.order.amount)).toBe(7500);
      expect(result.r.points_delta).toBe(7);

      const awa = await client(db, AWA);
      expect(Number(awa.total_spent)).toBe(26500);
      expect(awa.visit_count).toBe(4);
      expect(awa.loyalty_points).toBe(76);

      const created = await rows<{ event: string; actor_id: string }>(
        db,
        'select event, actor_id from client_order_events where order_id = $1',
        [newOrderId]
      );
      expect(created).toEqual([{ event: 'created', actor_id: USER_A }]);
      const earn = await one<{ kind: string; points_delta: number }>(
        db,
        'select kind, points_delta from loyalty_transactions where visit_id = $1',
        [newOrderId]
      );
      expect(earn).toEqual({ kind: 'earn', points_delta: 7 });
    });

    it('n’enregistre rien si une ligne est invalide (tout ou rien)', async () => {
      const count = async () => (await one<{ n: number }>(db, 'select count(*)::int n from client_visits')).n;
      const before = await count();
      await expect(
        asUser(db, USER_A, (tx) =>
          tx.query(
            `select record_client_order($1, $2, now(), 'sur_place', 'cash', $3::jsonb, null, 0, null)`,
            [ORG_A, AWA, JSON.stringify([{ name: 'Plat', quantity: 0, unit_price: 1000 }])]
          )
        )
      ).rejects.toThrow(/Quantité invalide/);
      expect(await count()).toBe(before);
      expect((await client(db, AWA)).loyalty_points).toBe(76);
    });

    it('refuse une remise supérieure au total', async () => {
      await expect(
        asUser(db, USER_A, (tx) =>
          tx.query(`select record_client_order($1, $2, now(), 'sur_place', 'cash', null, 2000, 3000, null)`, [ORG_A, AWA])
        )
      ).rejects.toThrow(/Remise invalide/);
    });

    it('modifie une commande et trace les champs changés', async () => {
      await asUser(db, USER_A, (tx) =>
        tx.query(`select update_client_order($1, $2, null, null, 'cash', null, null, null, null)`, [ORG_A, newOrderId])
      );
      const o = await order(db, newOrderId);
      expect(Number(o.amount)).toBe(7500);
      const updated = await one<{ changes: Record<string, { avant: unknown; apres: unknown }>; reason: string }>(
        db,
        "select changes, reason from client_order_events where order_id = $1 and event = 'updated'",
        [newOrderId]
      );
      expect(updated.changes.payment_method).toEqual({ avant: 'wave', apres: 'cash' });
      expect(updated.reason).toBe('Modification de la commande');
    });

    it('rembourse partiellement : montant net, points et totaux ajustés', async () => {
      await asUser(db, USER_A, (tx) =>
        tx.query(`select refund_client_order($1, $2, 3000, 'Plat froid')`, [ORG_A, newOrderId])
      );
      const o = await order(db, newOrderId);
      expect(o.status).toBe('partially_refunded');
      expect(Number(o.refunded_amount)).toBe(3000);
      const awa = await client(db, AWA);
      expect(Number(awa.total_spent)).toBe(23500);
      expect(awa.loyalty_points).toBe(73);
    });

    it('exige un motif pour annuler', async () => {
      await expect(
        asUser(db, USER_A, (tx) => tx.query(`select cancel_client_order($1, $2, '  ')`, [ORG_A, newOrderId]))
      ).rejects.toThrow(/motif/);
    });

    it('annule : commande conservée, points retirés, totaux recalculés, historique complet', async () => {
      const res = await asUser(db, USER_A, (tx) =>
        one<{ r: { points_delta: number } }>(tx, `select cancel_client_order($1, $2, 'Erreur de saisie') as r`, [
          ORG_A,
          newOrderId,
        ])
      );
      expect(res.r.points_delta).toBe(-4);

      const o = await order(db, newOrderId);
      expect(o.status).toBe('cancelled');
      expect(Number(o.amount)).toBe(7500);
      const awa = await client(db, AWA);
      expect(Number(awa.total_spent)).toBe(19000);
      expect(awa.visit_count).toBe(3);
      expect(awa.loyalty_points).toBe(69);

      const events = await rows<{ event: string; reason: string | null }>(
        db,
        'select event, reason from client_order_events where order_id = $1 order by created_at, event',
        [newOrderId]
      );
      expect(events.map((e) => e.event).sort()).toEqual(['cancelled', 'created', 'refunded', 'updated']);
      expect(events.find((e) => e.event === 'cancelled')?.reason).toBe('Erreur de saisie');
      expect(events.find((e) => e.event === 'refunded')?.reason).toBe('Plat froid');

      const sum = await one<{ s: number }>(
        db,
        'select coalesce(sum(points_delta), 0)::int s from loyalty_transactions where visit_id = $1',
        [newOrderId]
      );
      expect(sum.s).toBe(0);
    });

    it('ne réannule pas, ne modifie pas et ne « ressuscite » pas une commande annulée', async () => {
      await expect(
        asUser(db, USER_A, (tx) => tx.query(`select cancel_client_order($1, $2, 'Encore')`, [ORG_A, newOrderId]))
      ).rejects.toThrow(/déjà annulée/);
      await expect(
        asUser(db, USER_A, (tx) =>
          tx.query(`select update_client_order($1, $2, null, null, null, null, 100, null, null)`, [ORG_A, newOrderId])
        )
      ).rejects.toThrow(/modification impossible/);
      await expect(
        asUser(db, USER_A, (tx) => tx.query(`update client_visits set status = 'paid' where id = $1`, [newOrderId]))
      ).rejects.toThrow(/permission denied/);
      // Second rempart, même pour un accès privilégié (service, SQL d'administration).
      await expect(db.query(`update client_visits set status = 'paid' where id = $1`, [newOrderId])).rejects.toThrow(
        /ne peut plus changer de statut/
      );
      expect((await order(db, newOrderId)).status).toBe('cancelled');
    });

    it('annule un ancien passage dont les points étaient reliés', async () => {
      await asUser(db, USER_A, (tx) => tx.query(`select cancel_client_order($1, $2, 'Doublon')`, [ORG_A, V1]));
      const awa = await client(db, AWA);
      expect(Number(awa.total_spent)).toBe(12000);
      expect(awa.loyalty_points).toBe(62);
    });

    it('ne retire pas des points historiques dont l’attribution n’est pas prouvée', async () => {
      const res = await asUser(db, USER_A, (tx) =>
        one<{ r: { points_delta: number } }>(tx, `select cancel_client_order($1, $2, 'Test') as r`, [ORG_A, V4])
      );
      expect(res.r.points_delta).toBe(0);
      const bara = await client(db, BARA);
      expect(bara.loyalty_points).toBe(25);
      expect(Number(bara.total_spent)).toBe(0);
      expect(bara.visit_count).toBe(0);
    });

    it('interdit la suppression d’une commande', async () => {
      await expect(
        asUser(db, USER_A, (tx) => tx.query('delete from client_visits where id = $1', [V2]))
      ).rejects.toThrow(/permission denied/);
      expect(await rows(db, 'select id from client_visits where id = $1', [V2])).toHaveLength(1);
    });

    it('interdit d’écrire directement dans les journaux', async () => {
      await expect(
        asUser(db, USER_A, (tx) =>
          tx.query(
            `insert into client_order_events (organization_id, order_id, client_id, event, status_after)
             values ($1, $2, $3, 'cancelled', 'cancelled')`,
            [ORG_A, V2, AWA]
          )
        )
      ).rejects.toThrow(/permission denied/);
      await expect(
        asUser(db, USER_A, (tx) => tx.query('update loyalty_transactions set points_delta = 999 where client_id = $1 returning id', [AWA]))
      ).rejects.toThrow(/permission denied/);
      const points = await rows<{ points_delta: number }>(
        db,
        'select points_delta from loyalty_transactions where client_id = $1 and points_delta = 999',
        [AWA]
      );
      expect(points).toHaveLength(0);
    });

    it('ajuste les points manuellement de façon atomique avec un motif', async () => {
      const res = await asUser(db, USER_A, (tx) =>
        one<{ b: number }>(tx, `select adjust_loyalty_points($1, $2, -10, 'Cadeau offert') as b`, [ORG_A, AWA])
      );
      expect(res.b).toBe(52);
      const tx = await one<{ kind: string; created_by: string }>(
        db,
        "select kind, created_by from loyalty_transactions where reason = 'Cadeau offert'"
      );
      expect(tx).toEqual({ kind: 'manual', created_by: USER_A });
    });
  });

  describe('consentement WhatsApp daté', () => {
    it('date et trace un accord donné', async () => {
      await asUser(db, USER_A, (tx) =>
        tx.query(
          "update clients set whatsapp_consent = 'accorde', whatsapp_consent_source = 'formulaire' where id = $1",
          [COUMBA]
        )
      );
      const coumba = await client(db, COUMBA);
      expect(coumba).toMatchObject({ whatsapp_consent: 'accorde', whatsapp_consent_source: 'formulaire', opt_in_whatsapp: true });
      expect(coumba.whatsapp_consent_at).toBeInstanceOf(Date);
      const last = await one<{ consent: string; source: string; actor_id: string }>(
        db,
        'select consent, source, actor_id from client_consent_events where client_id = $1 order by created_at desc limit 1',
        [COUMBA]
      );
      expect(last).toEqual({ consent: 'accorde', source: 'formulaire', actor_id: USER_A });
    });

    it('trace aussi un retrait fait par l’ancien formulaire (opt_in_whatsapp)', async () => {
      await asUser(db, USER_A, (tx) => tx.query('update clients set opt_in_whatsapp = false where id = $1', [AWA]));
      const awa = await client(db, AWA);
      expect(awa).toMatchObject({ whatsapp_consent: 'refuse', whatsapp_consent_source: 'ancien_formulaire', opt_in_whatsapp: false });
      const n = await one<{ n: number }>(db, 'select count(*)::int n from client_consent_events where client_id = $1', [AWA]);
      expect(n.n).toBe(2);
    });

    it('ne laisse pas antidater un consentement', async () => {
      const before = await client(db, COUMBA);
      await asUser(db, USER_A, (tx) =>
        tx.query("update clients set whatsapp_consent_at = '2020-01-01T00:00:00Z', whatsapp_consent_source = 'faux' where id = $1", [COUMBA])
      );
      const after = await client(db, COUMBA);
      expect(after.whatsapp_consent_at?.toISOString()).toBe(before.whatsapp_consent_at?.toISOString());
      expect(after.whatsapp_consent_source).toBe('formulaire');
    });

    it('un nouveau client n’est pas contactable par défaut', async () => {
      const created = await asUser(db, USER_A, (tx) =>
        one<{ opt_in_whatsapp: boolean; whatsapp_consent: string; phone_e164: string }>(
          tx,
          `insert into clients (organization_id, full_name, phone) values ($1, 'Nouveau', '78 000 11 22')
           returning opt_in_whatsapp, whatsapp_consent, phone_e164`,
          [ORG_A]
        )
      );
      expect(created).toEqual({ opt_in_whatsapp: false, whatsapp_consent: 'refuse', phone_e164: '+221780001122' });
    });
  });

  describe('isolation entre restaurants', () => {
    const tables = [
      'clients',
      'client_visits',
      'visit_items',
      'loyalty_transactions',
      'client_order_events',
      'client_consent_events',
      'client_phone_duplicates',
    ];

    it.each(tables)('le restaurant B ne voit aucune ligne du restaurant A dans %s', async (table) => {
      const visible = await asUser(db, USER_B, (tx) =>
        rows<{ organization_id: string }>(tx, `select organization_id from ${table}`)
      );
      expect(visible.every((r) => r.organization_id === ORG_B)).toBe(true);
      const leaked = await asUser(db, USER_B, (tx) =>
        rows(tx, `select 1 from ${table} where organization_id = $1`, [ORG_A])
      );
      expect(leaked).toHaveLength(0);
    });

    // En se réclamant de A, B est refusé (pas membre) ; en passant son propre
    // restaurant avec un identifiant de A, la ligne est introuvable.
    const asA = { org: ORG_A, error: /Action non autorisée/ };
    const asOwnOrg = { org: ORG_B, error: /introuvable/ };

    it('le restaurant B ne peut pas enregistrer de commande pour un client de A', async () => {
      for (const { org, error } of [asA, asOwnOrg]) {
        await expect(
          asUser(db, USER_B, (tx) =>
            tx.query(`select record_client_order($1, $2, now(), 'sur_place', 'cash', null, 1000, 0, null)`, [org, AWA])
          )
        ).rejects.toThrow(error);
      }
    });

    it('le restaurant B ne peut ni annuler, ni rembourser, ni modifier une commande de A', async () => {
      for (const { org, error } of [asA, asOwnOrg]) {
        await expect(
          asUser(db, USER_B, (tx) => tx.query(`select cancel_client_order($1, $2, 'x')`, [org, V2]))
        ).rejects.toThrow(error);
        await expect(
          asUser(db, USER_B, (tx) => tx.query(`select refund_client_order($1, $2, 100, 'x')`, [org, V2]))
        ).rejects.toThrow(error);
        await expect(
          asUser(db, USER_B, (tx) =>
            tx.query(`select update_client_order($1, $2, null, null, null, null, 1, null, null)`, [org, V2])
          )
        ).rejects.toThrow(error);
      }
      expect((await order(db, V2)).status).toBe('paid');
    });

    it('le restaurant B ne peut pas ajuster les points ni recalculer les totaux d’un client de A', async () => {
      const before = await client(db, AWA);
      for (const { org, error } of [asA, asOwnOrg]) {
        await expect(
          asUser(db, USER_B, (tx) => tx.query(`select adjust_loyalty_points($1, $2, 100, 'x')`, [org, AWA]))
        ).rejects.toThrow(error);
      }
      await expect(
        asUser(db, USER_B, (tx) => tx.query('select refresh_client_aggregates($1)', [AWA]))
      ).rejects.toThrow(/Action non autorisée/);
      expect((await client(db, AWA)).loyalty_points).toBe(before.loyalty_points);
    });

    it('le restaurant B ne peut pas utiliser un article du catalogue de A', async () => {
      await expect(
        asUser(db, USER_B, (tx) =>
          tx.query(`select record_client_order($1, $2, now(), 'sur_place', 'cash', $3::jsonb, null, 0, null)`, [
            ORG_B,
            DIEU,
            JSON.stringify([{ catalog_item_id: THIEB, name: 'Thieboudienne', quantity: 1, unit_price: 3500 }]),
          ])
        )
      ).rejects.toThrow(/catalogue introuvable/);
    });

    const crossTenantWrites: [string, string, unknown[]][] = [
      ['commande de B pour un client de A', `insert into client_visits (organization_id, client_id, amount) values ($1, $2, 1000)`, [ORG_B, AWA]],
      [
        'ligne de B dans une commande de A',
        `insert into visit_items (organization_id, visit_id, name, quantity, unit_price, line_total) values ($1, $2, 'x', 1, 1, 1)`,
        [ORG_B, V2],
      ],
      [
        'points de B pour un client de A',
        `insert into loyalty_transactions (organization_id, client_id, points_delta, reason) values ($1, $2, 100, 'x')`,
        [ORG_B, AWA],
      ],
    ];

    it.each(crossTenantWrites)('refuse l’écriture directe : %s (droits puis clé étrangère)', async (_label, sql, params) => {
      await expect(asUser(db, USER_B, (tx) => tx.query(sql, params))).rejects.toThrow(/permission denied/);
      // Même avec un accès privilégié qui contourne la RLS, la clé composite bloque.
      await expect(db.query(sql, params)).rejects.toThrow(/foreign key/);
    });

    it('refuse à B d’écrire une commande au nom de A', async () => {
      await expect(
        asUser(db, USER_B, (tx) =>
          tx.query(`insert into client_visits (organization_id, client_id, amount) values ($1, $2, 1000)`, [ORG_A, AWA])
        )
      ).rejects.toThrow(/permission denied/);
    });

    it('le restaurant B ne peut pas modifier un client de A', async () => {
      const res = await asUser(db, USER_B, (tx) =>
        tx.query(`update clients set total_spent = 0, whatsapp_consent = 'accorde' where id = $1 returning id`, [AWA])
      );
      expect(res.rows).toHaveLength(0);
      expect((await client(db, AWA)).whatsapp_consent).toBe('refuse');
    });
  });

  describe('numéros de téléphone (stockage, doublons, même règle que l’application)', () => {
    const samples: [string, string | null][] = [
      ['06 123 45 67', 'CG'],
      ['05 123 45 67', 'CG'],
      ['+242 06 123 45 67', 'CG'],
      ['+242 05 123 45 67', 'CG'],
      ['242061234567', 'CG'],
      ['00242 05 123 45 67', 'CG'],
      ['  +242 06 123 45 67', 'CG'],
      ['77 123 45 67', 'SN'],
      ['+221 77 123 45 67', 'CG'],
      ['07 01 02 03 04', 'CI'],
      ['06 12 34 56 78', 'FR'],
      ['0812345678', 'CD'],
      ['0612345678', 'MA'],
      ['0803 123 4567', 'NG'],
      ['6 77 12 34 56', 'CM'],
      ['77 123 45 67', 'US'],
      ['77 123 45 67', null],
      ['', 'CG'],
    ];

    it('normalize_phone_e164 (SQL) et normalizePhoneE164 (TypeScript) donnent le même résultat', async () => {
      for (const [raw, country] of samples) {
        const sql = await one<{ e: string | null }>(db, 'select normalize_phone_e164($1, $2) as e', [raw, country]);
        expect({ raw, country, e164: sql.e }).toEqual({ raw, country, e164: normalizePhoneE164(raw, country) });
      }
    });

    it('stocke les numéros congolais avec leur 0 et regroupe local / international comme doublons', async () => {
      const created = await asUser(db, USER_B, (tx) =>
        rows<{ phone: string; phone_e164: string }>(
          tx,
          `insert into clients (organization_id, full_name, phone) values
             ($1, 'Local 06', '06 555 12 34'), ($1, 'Inter 06', '+242 06 555 12 34'),
             ($1, 'Local 05', '05 555 12 34'), ($1, 'Inter 05', '+242 05 555 12 34')
           returning phone, phone_e164`,
          [ORG_B]
        )
      );
      expect(created.map((c) => c.phone_e164)).toEqual([
        '+242065551234',
        '+242065551234',
        '+242055551234',
        '+242055551234',
      ]);
      expect(created.map((c) => c.phone)).toEqual(['06 555 12 34', '+242 06 555 12 34', '05 555 12 34', '+242 05 555 12 34']);

      const dups = await asUser(db, USER_B, (tx) =>
        rows<{ phone_e164: string; client_count: number }>(
          tx,
          'select phone_e164, client_count from client_phone_duplicates order by phone_e164'
        )
      );
      expect(dups).toEqual([
        { phone_e164: '+242055551234', client_count: 2 },
        { phone_e164: '+242065551234', client_count: 2 },
      ]);
    });
  });

  describe('droits par rôle dans un même restaurant', () => {
    const STAFF_A = 'aaaaaaaa-0000-4000-8000-0000000000a2';
    const VIEWER_A = 'aaaaaaaa-0000-4000-8000-0000000000a3';
    const MANAGER_A = 'aaaaaaaa-0000-4000-8000-0000000000a4';
    const ODD_A = 'aaaaaaaa-0000-4000-8000-0000000000a5';
    const SUSPENDED_A = 'aaaaaaaa-0000-4000-8000-0000000000a6';
    const NOROLE_A = 'aaaaaaaa-0000-4000-8000-0000000000a7';
    const EMMA = 'aaaaaaaa-0000-4000-8000-0000000000c7';

    beforeAll(async () => {
      await db.exec(`
        insert into auth.users (id, email) values
          ('${STAFF_A}', 'equipe-a@test.local'), ('${VIEWER_A}', 'lecture-a@test.local'),
          ('${MANAGER_A}', 'gerant2-a@test.local'), ('${ODD_A}', 'inconnu-a@test.local'),
          ('${SUSPENDED_A}', 'suspendu-a@test.local'), ('${NOROLE_A}', 'sans-role-a@test.local');
        -- Production may still have the nullable column added by 027.
        alter table organization_members alter column role_id drop not null;
        insert into organization_members (organization_id, user_id, role_id, status)
          values ('${ORG_A}', '${NOROLE_A}', null, 'active');
        insert into clients (id, organization_id, full_name, phone)
          values ('${EMMA}', '${ORG_A}', 'Emma Test', '77 555 00 07');
        insert into roles (scope, code, name) values ('organization', 'caissier_maison', 'Caissier maison');
        insert into organization_members (organization_id, user_id, role_id, status)
          select '${ORG_A}', u.id, r.id, u.status
          from (values ('${STAFF_A}'::uuid, 'org_staff', 'active'),
                       ('${VIEWER_A}'::uuid, 'org_viewer', 'active'),
                       ('${MANAGER_A}'::uuid, 'org_manager', 'active'),
                       ('${ODD_A}'::uuid, 'caissier_maison', 'active'),
                       ('${SUSPENDED_A}'::uuid, 'org_owner', 'suspended')) as u(id, code, status)
          join roles r on r.scope = 'organization' and r.code = u.code;
      `);
    });

    const denied = [
      { label: 'lecture seule', user: VIEWER_A },
      { label: 'rôle inconnu', user: ODD_A },
      { label: 'membre suspendu', user: SUSPENDED_A },
      { label: 'membre sans rôle', user: NOROLE_A },
    ];

    it('ne présente plus un membre sans rôle comme propriétaire', async () => {
      const res = await asUser(db, NOROLE_A, (tx) =>
        one<{ organization_id: string; role_code: string | null; level: number }>(
          tx,
          `select m.organization_id, m.role_code, current_org_role_level($1) as level
           from get_my_active_membership() m`,
          [ORG_A]
        )
      );
      expect(res).toEqual({ organization_id: ORG_A, role_code: null, level: 0 });
    });

    it.each(denied)('refuse toute écriture de commande ou de points ($label)', async ({ user }) => {
      const before = await client(db, AWA);
      const attempts = [
        `select record_client_order('${ORG_A}', '${AWA}', now(), 'sur_place', 'cash', null, 1000, 0, null)`,
        `select update_client_order('${ORG_A}', '${V2}', null, null, 'card', null, null, null, null)`,
        `select cancel_client_order('${ORG_A}', '${V2}', 'Test droits')`,
        `select refund_client_order('${ORG_A}', '${V2}', 100, 'Test droits')`,
        `select adjust_loyalty_points('${ORG_A}', '${AWA}', 100, 'Test droits')`,
        `select refresh_client_aggregates('${AWA}')`,
      ];
      for (const sql of attempts) {
        await expect(asUser(db, user, (tx) => tx.query(sql))).rejects.toThrow(/Action non autorisée/);
      }
      expect(await client(db, AWA)).toEqual(before);
      expect((await order(db, V2)).status).toBe('paid');
    });

    it('l’équipe enregistre une commande (points automatiques) mais n’ajuste pas les points à la main', async () => {
      const res = await asUser(db, STAFF_A, (tx) =>
        one<{ r: { points_delta: number } }>(
          tx,
          `select record_client_order($1, $2, now(), 'a_emporter', 'orange_money', null, 4000, 0, null) as r`,
          [ORG_A, COUMBA]
        )
      );
      expect(res.r.points_delta).toBe(4);
      await expect(
        asUser(db, STAFF_A, (tx) => tx.query(`select adjust_loyalty_points($1, $2, 100, 'Bonus')`, [ORG_A, COUMBA]))
      ).rejects.toThrow(/Action non autorisée/);
      expect((await client(db, COUMBA)).loyalty_points).toBe(4);
    });

    it('le gérant peut ajuster les points avec un motif', async () => {
      const res = await asUser(db, MANAGER_A, (tx) =>
        one<{ b: number }>(tx, `select adjust_loyalty_points($1, $2, 5, 'Geste commercial') as b`, [ORG_A, COUMBA])
      );
      expect(res.b).toBe(9);
      const tx = await one<{ created_by: string }>(
        db,
        "select created_by from loyalty_transactions where reason = 'Geste commercial'"
      );
      expect(tx.created_by).toBe(MANAGER_A);
    });

    const recordFor = async (user: string, amount: number) =>
      (
        await asUser(db, user, (tx) =>
          one<{ id: string }>(
            tx,
            `select (record_client_order($1, $2, now(), 'sur_place', 'cash', null, $3, 0, null)->'order'->>'id') as id`,
            [ORG_A, EMMA, amount]
          )
        )
      ).id;

    it('l’équipe corrige ou annule sa propre saisie dans les 15 minutes', async () => {
      const id = await recordFor(STAFF_A, 3000);
      await asUser(db, STAFF_A, (tx) =>
        tx.query(`select update_client_order($1, $2, null, null, 'wave', null, 2500, null, null)`, [ORG_A, id])
      );
      expect(Number((await order(db, id)).amount)).toBe(2500);
      await asUser(db, STAFF_A, (tx) => tx.query(`select cancel_client_order($1, $2, 'Erreur de saisie')`, [ORG_A, id]));
      expect((await order(db, id)).status).toBe('cancelled');
      expect((await client(db, EMMA)).loyalty_points).toBe(0);
    });

    it('l’équipe ne rembourse pas et ne touche ni une commande ancienne, ni celle d’un autre', async () => {
      const own = await recordFor(STAFF_A, 3000);
      const managers = await recordFor(MANAGER_A, 6000);
      await db.query(`update client_visits set created_at = now() - interval '16 minutes' where id = $1`, [own]);
      const legacyBefore = await order(db, V1);

      const attempts: [string, unknown[]][] = [
        [`select refund_client_order($1, $2, 1000, 'Geste')`, [ORG_A, own]],
        [`select update_client_order($1, $2, null, null, 'card', null, 1, null, null)`, [ORG_A, own]],
        [`select cancel_client_order($1, $2, 'Trop tard')`, [ORG_A, own]],
        [`select cancel_client_order($1, $2, 'Pas la mienne')`, [ORG_A, managers]],
        [`select update_client_order($1, $2, null, null, 'card', null, 1, null, null)`, [ORG_A, managers]],
        [`select cancel_client_order($1, $2, 'Historique')`, [ORG_A, V1]],
      ];
      for (const [sql, params] of attempts) {
        await expect(asUser(db, STAFF_A, (tx) => tx.query(sql, params))).rejects.toThrow(/Action non autorisée/);
      }
      expect([(await order(db, own)).status, (await order(db, managers)).status]).toEqual(['paid', 'paid']);
      expect(await order(db, V1)).toEqual(legacyBefore);
      expect(Number((await order(db, own)).amount)).toBe(3000);
      expect((await client(db, EMMA)).loyalty_points).toBe(9);
    });

    it('le gérant annule ou rembourse toute commande, avec motif et trace de l’auteur', async () => {
      const refunded = await recordFor(STAFF_A, 1000);
      const cancelled = await recordFor(STAFF_A, 2000);
      await db.query(`update client_visits set created_at = now() - interval '2 hours' where id = any($1::uuid[])`, [
        [refunded, cancelled],
      ]);
      await expect(
        asUser(db, MANAGER_A, (tx) => tx.query(`select refund_client_order($1, $2, 500, '  ')`, [ORG_A, refunded]))
      ).rejects.toThrow(/motif du remboursement est obligatoire/);
      await asUser(db, MANAGER_A, (tx) =>
        tx.query(`select refund_client_order($1, $2, 500, 'Plat froid')`, [ORG_A, refunded])
      );
      await asUser(db, MANAGER_A, (tx) =>
        tx.query(`select cancel_client_order($1, $2, 'Client parti sans payer')`, [ORG_A, cancelled])
      );
      expect([(await order(db, refunded)).status, (await order(db, cancelled)).status]).toEqual([
        'partially_refunded',
        'cancelled',
      ]);

      const events = await rows<{ order_id: string; event: string; actor_id: string; reason: string | null }>(
        db,
        `select order_id, event, actor_id, reason from client_order_events
         where order_id = any($1::uuid[]) and event <> 'updated'`,
        [[refunded, cancelled]]
      );
      expect(events.filter((e) => e.event === 'created').map((e) => e.actor_id)).toEqual([STAFF_A, STAFF_A]);
      expect(events.find((e) => e.event === 'refunded')).toMatchObject({
        order_id: refunded,
        actor_id: MANAGER_A,
        reason: 'Plat froid',
      });
      expect(events.find((e) => e.event === 'cancelled')).toMatchObject({
        order_id: cancelled,
        actor_id: MANAGER_A,
        reason: 'Client parti sans payer',
      });
    });

    const bypasses: [string, string][] = [
      ['modifier le solde de points', `update clients set loyalty_points = 100000 where id = '${COUMBA}'`],
      ['modifier les dépenses cumulées', `update clients set total_spent = 999999, visit_count = 50 where id = '${COUMBA}'`],
      [
        'créer un client avec des points',
        `insert into clients (organization_id, full_name, loyalty_points) values ('${ORG_A}', 'Faux fidèle', 5000)`,
      ],
    ];

    it.each(bypasses)('même le propriétaire ne peut pas %s directement', async (_label, sql) => {
      await expect(asUser(db, USER_A, (tx) => tx.query(sql))).rejects.toThrow(/calculés à partir des commandes/);
      expect((await client(db, COUMBA)).loyalty_points).toBe(9);
    });

    it('bloque la fabrication de points via un mouvement fictif relié à une commande', async () => {
      await expect(
        asUser(db, USER_A, (tx) =>
          tx.query(
            `insert into loyalty_transactions (organization_id, client_id, visit_id, kind, points_delta, reason)
             values ($1, $2, $3, 'reverse', -1000, 'fictif')`,
            [ORG_A, AWA, V2]
          )
        )
      ).rejects.toThrow(/permission denied/);
      await expect(
        asUser(db, USER_A, (tx) => tx.query(`update client_visits set amount = 10000000 where id = $1`, [V2]))
      ).rejects.toThrow(/permission denied/);
      for (const sql of [
        `select sync_order_loyalty('${V2}', 'x')`,
        `select insert_order_items('${ORG_A}', '${V2}', '[{"name":"x","quantity":1,"unit_price":1}]'::jsonb)`,
        `select refresh_client_aggregates_unchecked('${AWA}')`,
      ]) {
        await expect(asUser(db, USER_A, (tx) => tx.query(sql))).rejects.toThrow(/permission denied/);
      }
    });

    it('laisse modifier normalement les autres informations du client', async () => {
      const res = await asUser(db, STAFF_A, (tx) =>
        tx.query(`update clients set notes = 'Allergie arachide' where id = $1 returning id`, [COUMBA])
      );
      expect(res.rows).toHaveLength(1);
    });
  });
});

describe('migration 040 — ligne historique reliée à un autre restaurant', () => {
  let db: PGlite;
  const STRAY = 'bbbbbbbb-0000-4000-8000-0000000000e9';

  beforeAll(async () => {
    db = (await replayMigrations('040')).db;
    await seedLegacy(
      db,
      `insert into client_visits (id, organization_id, client_id, kind, visited_at, amount)
       values ('${STRAY}', '${ORG_B}', '${AWA}', 'visit', '2026-09-08T12:00:00Z', 9000);`
    );
    await db.exec(readMigration(MIGRATION_040));
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it('termine la migration sans perdre la ligne incohérente', async () => {
    const stray = await order(db, STRAY);
    expect(Number(stray.amount)).toBe(9000);
  });

  it('laisse la contrainte active mais non validée pour signaler l’incohérence', async () => {
    const c = await one<{ convalidated: boolean }>(
      db,
      "select convalidated from pg_constraint where conname = 'client_visits_client_same_org_fkey'"
    );
    expect(c.convalidated).toBe(false);
    await expect(
      db.query(`insert into client_visits (organization_id, client_id, amount) values ($1, $2, 1)`, [ORG_B, AWA])
    ).rejects.toThrow(/foreign key/);
  });

  it('n’ajoute pas la ligne d’un autre restaurant aux totaux du client', async () => {
    expect(Number((await client(db, AWA)).total_spent)).toBe(19000);
  });
});

describe('rapport de comptage avant migration (supabase/reports/040_preflight_counts.sql)', () => {
  type ReportRow = { ordre: number; section: string; mesure: string; valeur: string; detail: string | null };
  const REPORT_SQL = readFileSync(join(MIGRATIONS_DIR, '../reports/040_preflight_counts.sql'), 'utf8');
  const STRAY = 'bbbbbbbb-0000-4000-8000-0000000000e9';
  const OLD_CG = 'bbbbbbbb-0000-4000-8000-0000000000c9';
  let db: PGlite;
  let report: ReportRow[];

  /** Sent in one piece, like a paste into the Supabase SQL editor. */
  const runReadOnly = async (target: PGlite) => {
    const results = await target.exec(REPORT_SQL);
    return results.at(-1)!.rows as ReportRow[];
  };
  const value = (mesure: string, detail: string | null = null) => {
    const found = report.filter((r) => r.mesure === mesure && r.detail === detail);
    if (found.length !== 1) throw new Error(`${mesure} (${detail}) : ${found.length} ligne(s)`);
    return Number(found[0]!.valeur);
  };

  beforeAll(async () => {
    db = (await replayMigrations('040')).db;
    await seedLegacy(
      db,
      `insert into client_visits (id, organization_id, client_id, kind, visited_at, amount)
         values ('${STRAY}', '${ORG_B}', '${AWA}', 'visit', '2026-09-08T12:00:00Z', 9000);
       insert into clients (id, organization_id, full_name, phone, opt_in_whatsapp)
         values ('${OLD_CG}', '${ORG_B}', 'Ancien import', '+24261234567', false);`
    );
    report = await runReadOnly(db);
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it('ne contient qu’une lecture (aucune instruction d’écriture hors commentaires)', () => {
    const code = REPORT_SQL.replace(/--.*$/gm, '');
    expect(code).not.toMatch(/\b(insert|update|delete|alter|create|drop|grant|revoke|truncate|copy|call|do)\b/i);
  });

  it('s’exécute dans une transaction en lecture seule', async () => {
    expect(REPORT_SQL.replace(/--.*$/gm, '').trim()).toMatch(/^SET TRANSACTION READ ONLY;/);
    const guard = REPORT_SQL.slice(0, REPORT_SQL.indexOf('WITH'));
    await expect(db.exec(`${guard} update clients set notes = 'x' where id = '${AWA}';`)).rejects.toThrow(
      /read-only transaction/
    );
    expect(report.length).toBeGreaterThan(40);
    expect(value('transaction_lecture_seule', 'on')).toBe(1);
    expect(value('appartenance_proprietaire_par_defaut', 'TABLE(organization_id uuid)')).toBe(0);
    expect(value('version_postgres_num', report.find((r) => r.mesure === 'version_postgres_num')!.detail)).toBeGreaterThan(0);
  });

  it('prouve dans son résultat la lecture seule et la visibilité de toutes les lignes', async () => {
    const execution = report.filter((r) => r.section === 'execution');
    expect(execution.map((r) => [r.mesure, Number(r.valeur)])).toEqual([
      ['transaction_lecture_seule', 1],
      ['role_voit_toutes_les_lignes', 1],
    ]);
    const withoutGuard = (await db.exec(REPORT_SQL.replace('SET TRANSACTION READ ONLY;', ''))).at(-1)!.rows as ReportRow[];
    const unguarded = withoutGuard.find((r) => r.mesure === 'transaction_lecture_seule')!;
    expect([Number(unguarded.valeur), unguarded.detail]).toEqual([0, 'off']);
  });

  it('n’oublie ni ne double aucune ligne (contrôles à 0)', () => {
    const controls = report.filter((r) => r.mesure.startsWith('controle_'));
    expect(controls.map((r) => [r.section, Number(r.valeur)])).toEqual([
      ['commandes', 0],
      ['montants_plats', 0],
      ['points', 0],
    ]);
  });

  it('compte exactement le jeu de données ancien', () => {
    expect({
      restaurants: value('restaurants'),
      clients: value('clients_total'),
      lignes: value('lignes_client_visits_total'),
      passages: value('anciens_passages_kind_visit'),
      depenses: value('depenses_kind_expense'),
      autres: value('autres_kind'),
      sansMontant: value('sans_montant'),
      montantXOF: value('montant_cumule_par_devise', 'XOF'),
      montantXAF: value('montant_cumule_par_devise', 'XAF'),
      depensesXOF: value('depenses_montant_cumule_par_devise', 'XOF'),
      avecPlats: value('commandes_avec_plats'),
      egal: value('montant_egal_somme_plats'),
      different: value('montant_different_somme_plats'),
      ecart: value('ecart_absolu_cumule'),
      autreResto: value('commandes_client_autre_restaurant'),
      orphelines: value('commandes_client_introuvable'),
      platsAutreResto: value('plats_commande_autre_restaurant') + value('plats_catalogue_autre_restaurant'),
      pointsAutreResto: value('points_client_autre_restaurant'),
      mouvements: value('mouvements_total'),
      automatiques: value('mouvements_automatiques'),
      rattachables: value('automatiques_rattachables_a_une_commande'),
      nonRattaches: value('automatiques_non_rattaches'),
      manuels: value('autres_mouvements_manuels'),
      soldeEcart: value('clients_solde_different_du_journal'),
      nbCommandesModifie: value('nombre_commandes_modifie'),
      depensesModifiees: value('depenses_cumulees_modifiees'),
      aConfirmer: value('opt_in_vrai_devient_a_confirmer'),
      refuse: value('opt_in_faux_ou_vide_devient_refuse'),
      doublons: value('groupes_de_doublons'),
      clientsDoublons: value('clients_dans_un_doublon'),
      congoSansZero: value('congo_8_chiffres_sans_0_suspects'),
      membres: value('membres_actifs'),
      proprietaires: value('membres_actifs_par_code', 'org_owner'),
      sansRoleReconnu: value('membres_sans_role_reconnu'),
    }).toEqual({
      restaurants: 2,
      clients: 5,
      lignes: 6,
      passages: 5,
      depenses: 1,
      autres: 0,
      sansMontant: 1,
      montantXOF: 44000,
      montantXAF: 14000,
      depensesXOF: 12000,
      avecPlats: 2,
      egal: 1,
      different: 1,
      ecart: 5000,
      autreResto: 1,
      orphelines: 0,
      platsAutreResto: 0,
      pointsAutreResto: 0,
      mouvements: 5,
      automatiques: 4,
      rattachables: 3,
      nonRattaches: 1,
      manuels: 1,
      soldeEcart: 0,
      nbCommandesModifie: 1,
      depensesModifiees: 0,
      aConfirmer: 2,
      refuse: 3,
      doublons: 1,
      clientsDoublons: 2,
      congoSansZero: 1,
      membres: 2,
      proprietaires: 2,
      sansRoleReconnu: 0,
    });
  });

  it('prévoit exactement ce que la migration 040 fait ensuite', async () => {
    const pointsBefore = await rows<{ id: string; loyalty_points: number }>(
      db,
      'select id, loyalty_points from clients order by id'
    );
    await db.exec(readMigration(MIGRATION_040));

    const after = await one<{ lignes: number; earn: number; expense: number; a_confirmer: number; dups: number }>(
      db,
      `select (select count(*)::int from client_visits) as lignes,
              (select count(*)::int from loyalty_transactions where kind = 'earn') as earn,
              (select count(*)::int from client_visits where legacy_kind = 'expense') as expense,
              (select count(*)::int from clients where whatsapp_consent = 'a_confirmer') as a_confirmer,
              (select count(*)::int from client_phone_duplicates) as dups`
    );
    expect(after).toEqual({
      lignes: value('lignes_client_visits_total'),
      earn: value('automatiques_rattachables_a_une_commande'),
      expense: value('depenses_kind_expense'),
      a_confirmer: value('opt_in_vrai_devient_a_confirmer'),
      dups: value('groupes_de_doublons'),
    });

    const spent = await rows<{ currency: string; total: string }>(
      db,
      `select o.currency, sum(c.total_spent) as total
       from clients c join organizations o on o.id = c.organization_id group by o.currency order by o.currency`
    );
    expect(spent.map((s) => [s.currency, Number(s.total)])).toEqual(
      ['XAF', 'XOF'].map((cur) => [cur, value('depenses_cumulees_apres_par_devise', cur)])
    );
    expect(await rows(db, 'select id, loyalty_points from clients order by id')).toEqual(pointsBefore);
    expect((await client(db, OLD_CG)).phone_e164).toBe('+24261234567');
  });
});
