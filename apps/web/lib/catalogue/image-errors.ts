/** Map raw OpenAI/worker errors to actionable French messages. */
export function humanizeImageGenerateError(raw: string): string {
  const t = (raw || '').toLowerCase();
  if (
    t.includes('billing_hard_limit') ||
    t.includes('billing hard limit') ||
    t.includes('insufficient_quota') ||
    t.includes('exceeded your current quota')
  ) {
    return 'Quota OpenAI épuisé (limite de facturation atteinte). Utilisez l’onglet Rechercher (images libres), Importer, ou augmentez le plafond sur platform.openai.com/settings/organization/billing.';
  }
  if (t.includes('does not exist') && t.includes('model')) {
    return 'Modèle d’image OpenAI indisponible. Réessayez plus tard ou utilisez Rechercher.';
  }
  if (t.includes('response_format')) {
    return 'API images OpenAI incompatible. Réessayez après mise à jour, ou utilisez Rechercher.';
  }
  if (t.includes('worker not configured') || t.includes('worker error')) {
    return raw;
  }
  // Strip huge JSON payloads for display
  if (raw.length > 180 && raw.includes('{')) {
    const short = raw.replace(/\s+/g, ' ').slice(0, 160);
    return `${short}… — Essayez l’onglet Rechercher (gratuit).`;
  }
  return raw;
}
