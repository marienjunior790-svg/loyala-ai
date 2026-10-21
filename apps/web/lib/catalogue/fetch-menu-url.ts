/**
 * Fetch public menu content from a URL for AI catalog import.
 * Handles static HTML pages and DigiMenu QR SPAs (API-backed).
 */

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PARTIAL_UUID_RE = /^[0-9a-f-]{8,35}$/i;

export type FetchMenuUrlResult =
  | { ok: true; text: string; source: 'html' | 'digimenu' | 'json' }
  | { ok: false; error: string };

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function localizedText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  for (const key of ['fr', 'en']) {
    if (typeof record[key] === 'string' && record[key].trim()) return record[key].trim();
  }
  for (const entry of Object.values(record)) {
    if (typeof entry === 'string' && entry.trim()) return entry.trim();
  }
  return '';
}

function formatMenuPrice(price: unknown, currency: string): string {
  if (Array.isArray(price)) {
    return price
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return '';
        const row = entry as Record<string, unknown>;
        if (row.price == null || row.price === '') return '';
        const label = typeof row.description === 'string' ? row.description.trim() : '';
        return label ? `${label} ${row.price}` : String(row.price);
      })
      .filter(Boolean)
      .join(' / ');
  }
  if (price == null || price === '') return '';
  return `${String(price)}${currency ? ` ${currency}` : ''}`;
}

/** Flatten DigiMenu / generic menu JSON into readable text for the AI importer. */
export function menuJsonToText(data: unknown, depth = 0): string {
  if (data == null) return '';
  if (typeof data === 'string' || typeof data === 'number') return String(data);
  if (Array.isArray(data)) {
    return data.map((x) => menuJsonToText(x, depth)).filter(Boolean).join('\n');
  }
  if (typeof data !== 'object') return '';

  const o = data as Record<string, unknown>;
  // DigiMenu often wraps payload
  if (o.status && o.data !== undefined && !Array.isArray(o) && depth === 0) {
    return menuJsonToText(o.data, depth + 1);
  }

  const name =
    localizedText(o.menu_title) ||
    localizedText(o.menu_titles) ||
    (typeof o.name === 'string' && o.name) ||
    (typeof o.title === 'string' && o.title) ||
    (typeof o.item_name === 'string' && o.item_name) ||
    localizedText(o.item_names) ||
    (typeof o.category_name === 'string' && o.category_name) ||
    '';
  const desc =
    (typeof o.description === 'string' && o.description) ||
    (typeof o.desc === 'string' && o.desc) ||
    (typeof o.item_description === 'string' && o.item_description) ||
    localizedText(o.item_descriptions) ||
    localizedText(o.menu_description) ||
    localizedText(o.menu_descriptions) ||
    '';
  const currency =
    (typeof o.currency === 'string' && o.currency) ||
    (typeof o.currency_code === 'string' && o.currency_code) ||
    '';
  const price = formatMenuPrice(
    o.price ?? o.selling_price ?? o.amount ?? o.base_price ?? o.item_price ?? null,
    currency
  );

  const lines: string[] = [];
  if (name) {
    lines.push(price ? `${name} — ${price}` : name);
  }
  if (desc && desc !== name) lines.push(desc);

  const childrenKeys = [
    'categories',
    'category',
    'sections',
    'items',
    'menu_items',
    'products',
    'children',
    'subcategories',
    'menus',
    'groups',
    'results',
  ];
  for (const key of childrenKeys) {
    if (o[key] != null) {
      const child = menuJsonToText(o[key], depth + 1);
      if (child) lines.push(child);
    }
  }

  // Fallback: walk unknown arrays of objects
  if (lines.length === 0) {
    for (const v of Object.values(o)) {
      if (Array.isArray(v) || (v && typeof v === 'object')) {
        const child = menuJsonToText(v, depth + 1);
        if (child) lines.push(child);
      }
    }
  }

  return lines.join('\n');
}

function extractDigiMenuId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (!host.includes('mydigimenu.com')) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  const candidate = parts[0] ?? '';
  if (UUID_RE.test(candidate)) return candidate;
  if (PARTIAL_UUID_RE.test(candidate) && candidate.length < 36) {
    return `__truncated__:${candidate}`;
  }
  return null;
}

async function fetchDigiMenuJson(url: string, menuId: string): Promise<unknown | null> {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(12_000),
    headers: {
      ...BROWSER_HEADERS,
      Accept: 'application/json',
      Origin: 'https://qr.mydigimenu.com',
      Referer: `https://qr.mydigimenu.com/${menuId}`,
    },
  });
  if (!res.ok) return null;
  return res.json();
}

async function loadDigiMenuSection(menuId: string, section: unknown): Promise<string> {
  const heading = menuJsonToText(section);
  const id =
    section && typeof section === 'object' && 'id' in section
      ? (section as { id: unknown }).id
      : null;
  if (typeof id !== 'number' && typeof id !== 'string') return heading;

  try {
    const data = await fetchDigiMenuJson(
      `https://api.mydigimenu.com/api/qr-menu-children/${menuId}/?menu=${encodeURIComponent(String(id))}&platform=qr&limit=1500&page=1`,
      menuId
    );
    const items = menuJsonToText(data);
    return [heading, items].filter(Boolean).join('\n');
  } catch {
    return heading;
  }
}

async function fetchDigiMenu(menuId: string): Promise<FetchMenuUrlResult> {
  try {
    const list = await fetchDigiMenuJson(
      `https://api.mydigimenu.com/api/qr-menu/${menuId}/?platform=qr`,
      menuId
    );
    if (Array.isArray(list) && list.length > 0) {
      const blocks = await Promise.all(
        list.slice(0, 12).map((section) => loadDigiMenuSection(menuId, section))
      );
      const text = blocks.filter(Boolean).join('\n\n');
      if (text.length >= 40) {
        return { ok: true, text: text.slice(0, 16_000), source: 'digimenu' };
      }
    }
  } catch {
    /* Les anciens points d'accès restent le repli. */
  }

  const endpoints = [
    `https://api.mydigimenu.com/api/qr-menu/${menuId}/?platform=qr`,
    `https://api.mydigimenu.com/api/qr-menu/${menuId}/`,
    `https://api.mydigimenu.com/api/qr-menu-children/${menuId}/?platform=qr`,
    `https://api.mydigimenu.com/api/online-menu/${menuId}/`,
  ];

  let lastError = 'Menu DigiMenu introuvable';
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        redirect: 'follow',
        signal: AbortSignal.timeout(15_000),
        headers: {
          ...BROWSER_HEADERS,
          Accept: 'application/json',
          Origin: 'https://qr.mydigimenu.com',
          Referer: `https://qr.mydigimenu.com/${menuId}`,
        },
      });
      const raw = await res.text();
      let data: unknown = raw;
      try {
        data = JSON.parse(raw);
      } catch {
        /* keep text */
      }

      if (typeof data === 'object' && data && !Array.isArray(data)) {
        const o = data as Record<string, unknown>;
        const statusMsg = typeof o.status === 'string' ? o.status : '';
        if (/no table|not found|no menu/i.test(statusMsg)) {
          lastError =
            'Ce QR DigiMenu est invalide ou expiré. Vérifiez que le lien est complet (UUID entier).';
          continue;
        }
        if (o.error) {
          lastError = String(o.error);
          continue;
        }
      }

      if (!res.ok && !Array.isArray(data)) continue;

      const text = menuJsonToText(data);
      if (text.length >= 40) {
        return { ok: true, text: text.slice(0, 16_000), source: 'digimenu' };
      }
      if (typeof data === 'string' && data.length >= 40) {
        return { ok: true, text: data.slice(0, 16_000), source: 'digimenu' };
      }
      lastError =
        'Menu DigiMenu vide ou inaccessible. Essayez une capture d’écran (import image) ou un PDF.';
    } catch {
      lastError = 'Impossible de joindre l’API DigiMenu';
    }
  }
  return { ok: false, error: lastError };
}

async function fetchHtmlPage(url: URL): Promise<FetchMenuUrlResult> {
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
      headers: BROWSER_HEADERS,
    });
  } catch {
    return { error: 'Impossible de récupérer cette page', ok: false };
  }

  // Some SPA hosts return 404 for deep links but still serve the app shell —
  // still try to read body, but prefer clear messaging.
  const html = (await res.text()).slice(0, 400_000);
  const text = stripHtml(html);

  if (!res.ok) {
    if (res.status === 404) {
      return {
        ok: false,
        error:
          'Page introuvable (404). Vérifiez le lien complet, ou importez via image / PDF / collage du menu.',
      };
    }
    return { ok: false, error: `La page a répondu ${res.status}` };
  }

  // Detect empty SPA shells
  if (text.length < 40 || /you need to enable javascript/i.test(text)) {
    return {
      ok: false,
      error:
        'Cette page charge le menu en JavaScript (SPA). Collez le texte du menu, importez une image/PDF, ou utilisez un lien DigiMenu QR complet.',
    };
  }

  // JSON served as document
  const trimmed = html.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const textFromJson = menuJsonToText(JSON.parse(trimmed));
      if (textFromJson.length >= 40) {
        return { ok: true, text: textFromJson.slice(0, 16_000), source: 'json' };
      }
    } catch {
      /* fall through */
    }
  }

  return { ok: true, text: text.slice(0, 16_000), source: 'html' };
}

/** Resolve a public menu URL into plain text suitable for catalog.import. */
export async function fetchMenuUrlContent(rawUrl: string): Promise<FetchMenuUrlResult> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { ok: false, error: 'URL invalide' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: 'Seules les URL http(s) sont autorisées' };
  }

  const digiId = extractDigiMenuId(url);
  if (digiId?.startsWith('__truncated__:')) {
    return {
      ok: false,
      error:
        'Lien DigiMenu incomplet. Collez l’URL entière (UUID complet, 36 caractères), pas une version tronquée.',
    };
  }
  if (digiId) {
    return fetchDigiMenu(digiId);
  }

  return fetchHtmlPage(url);
}
