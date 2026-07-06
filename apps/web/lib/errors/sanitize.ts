/** User-safe error messages — hide internal DB/stack details in production. */
export function sanitizeUserErrorMessage(message: string): string {
  if (process.env.NODE_ENV !== 'production') return message;

  const lower = message.toLowerCase();
  if (
    lower.includes('permission denied') ||
    lower.includes('row-level security') ||
    lower.includes('rls') ||
    lower.includes('pgrst') ||
    lower.includes('violates') ||
    lower.includes('sql') ||
    lower.includes('relation') ||
    lower.includes('column')
  ) {
    return 'Une erreur technique est survenue. Réessayez ou contactez le support.';
  }

  if (message.length > 200) {
    return `${message.slice(0, 200)}…`;
  }

  return message;
}
