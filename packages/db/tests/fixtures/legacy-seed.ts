import type { PGlite } from '@electric-sql/pglite';

export const MIGRATION_040 = '040_customer_orders_traceability.sql';

export const ORG_A = 'aaaaaaaa-0000-4000-8000-000000000001';
export const ORG_B = 'bbbbbbbb-0000-4000-8000-000000000001';
export const USER_A = 'aaaaaaaa-0000-4000-8000-0000000000a1';
export const USER_B = 'bbbbbbbb-0000-4000-8000-0000000000b1';
export const AWA = 'aaaaaaaa-0000-4000-8000-0000000000c1';
export const BARA = 'aaaaaaaa-0000-4000-8000-0000000000c2';
export const COUMBA = 'aaaaaaaa-0000-4000-8000-0000000000c3';
export const DIEU = 'bbbbbbbb-0000-4000-8000-0000000000c1';
export const THIEB = 'aaaaaaaa-0000-4000-8000-0000000000d1';
export const MANIOC = 'bbbbbbbb-0000-4000-8000-0000000000d1';
export const V1 = 'aaaaaaaa-0000-4000-8000-0000000000e1';
export const V2 = 'aaaaaaaa-0000-4000-8000-0000000000e2';
export const V3 = 'aaaaaaaa-0000-4000-8000-0000000000e3';
export const V4 = 'aaaaaaaa-0000-4000-8000-0000000000e4';
export const V5 = 'bbbbbbbb-0000-4000-8000-0000000000e1';

/** Legacy data as written by the pre-040 application (visits, expenses, items, points). */
export async function seedLegacy(db: PGlite, extraSql = ''): Promise<void> {
  await db.exec(`
    insert into auth.users (id, email) values
      ('${USER_A}', 'gerant-a@test.local'), ('${USER_B}', 'gerant-b@test.local');
    insert into organizations (id, slug, name, country_code, timezone, currency) values
      ('${ORG_A}', 'resto-a', 'Restaurant A', 'SN', 'Africa/Dakar', 'XOF'),
      ('${ORG_B}', 'resto-b', 'Restaurant B', 'CG', 'Africa/Brazzaville', 'XAF');
    insert into organization_members (organization_id, user_id, role_id, status)
      select '${ORG_A}', '${USER_A}', id, 'active' from roles order by level desc limit 1;
    insert into organization_members (organization_id, user_id, role_id, status)
      select '${ORG_B}', '${USER_B}', id, 'active' from roles order by level desc limit 1;

    insert into clients (id, organization_id, full_name, phone, opt_in_whatsapp, visit_count, total_spent, loyalty_points, last_visit_at, created_at, updated_at) values
      ('${AWA}', '${ORG_A}', 'Awa Test', '77 123 45 67', true, 2, 19000, 69, '2026-09-15T12:00:00Z', '2026-08-01T10:00:00Z', '2026-08-01T10:00:00Z'),
      ('${BARA}', '${ORG_A}', 'Bara Test', '+221 76 000 00 01', false, 1, 25000, 25, '2026-09-20T12:00:00Z', '2026-08-02T10:00:00Z', '2026-08-02T10:00:00Z'),
      ('${COUMBA}', '${ORG_A}', 'Coumba Test', '771234567', false, 0, 0, 0, null, '2026-08-03T10:00:00Z', '2026-08-03T10:00:00Z'),
      ('${DIEU}', '${ORG_B}', 'Dieudonné Test', '06 123 4567', true, 1, 5000, 5, '2026-09-05T12:00:00Z', '2026-08-04T10:00:00Z', '2026-08-04T10:00:00Z');

    insert into catalog_items (id, organization_id, name, price) values
      ('${THIEB}', '${ORG_A}', 'Thieboudienne', 3500),
      ('${MANIOC}', '${ORG_B}', 'Saka-saka', 2500);

    insert into client_visits (id, organization_id, client_id, kind, visited_at, amount, created_at, updated_at) values
      ('${V1}', '${ORG_A}', '${AWA}', 'visit', '2026-09-01T12:00:00Z', 7000, '2026-09-01T12:00:00Z', '2026-09-01T12:00:00Z'),
      ('${V2}', '${ORG_A}', '${AWA}', 'expense', '2026-09-10T12:00:00Z', 12000, '2026-09-10T12:00:00Z', '2026-09-10T12:00:00Z'),
      ('${V3}', '${ORG_A}', '${AWA}', 'visit', '2026-09-15T12:00:00Z', null, '2026-09-15T12:00:00Z', '2026-09-15T12:00:00Z'),
      ('${V4}', '${ORG_A}', '${BARA}', 'visit', '2026-09-20T12:00:00Z', 25000, '2026-09-20T12:00:00Z', '2026-09-21T09:00:00Z'),
      ('${V5}', '${ORG_B}', '${DIEU}', 'visit', '2026-09-05T12:00:00Z', 5000, '2026-09-05T12:00:00Z', '2026-09-05T12:00:00Z');

    insert into visit_items (organization_id, visit_id, catalog_item_id, name, category_name, quantity, unit_price, line_total) values
      ('${ORG_A}', '${V1}', '${THIEB}', 'Thieboudienne', 'Plats', 2, 3500, 7000),
      ('${ORG_A}', '${V4}', '${THIEB}', 'Thieboudienne', 'Plats', 1, 3500, 3500),
      ('${ORG_A}', '${V4}', null, 'Boissons', 'Boissons', 1, 16500, 16500);

    insert into loyalty_transactions (organization_id, client_id, points_delta, reason, created_at) values
      ('${ORG_A}', '${AWA}', 7, 'Visite automatique · 7 000 XOF → +7 pts', '2026-09-01T12:00:03Z'),
      ('${ORG_A}', '${AWA}', 12, 'Dépense automatique · 12 000 XOF → +12 pts', '2026-09-10T12:00:05Z'),
      ('${ORG_A}', '${BARA}', 25, 'Visite automatique · 25 000 XOF → +25 pts', '2026-09-20T12:10:00Z'),
      ('${ORG_A}', '${AWA}', 50, 'Bonus anniversaire', '2026-09-02T09:00:00Z'),
      ('${ORG_B}', '${DIEU}', 5, 'Visite automatique · 5 000 XOF → +5 pts', '2026-09-05T12:00:02Z');
    ${extraSql}
  `);
}
