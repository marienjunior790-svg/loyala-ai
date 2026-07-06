import {
  collectWebEnvIssues,
  hasCriticalWebEnvIssues,
  type WebEnvIssue,
} from '@loyala/validation';

const isBuildPhase =
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.NEXT_PHASE === 'phase-export';

function logIssues(issues: WebEnvIssue[]): void {
  for (const issue of issues) {
    const line = `[loyala-web] ${issue.message}`;
    if (issue.severity === 'critical') console.error(line);
    else if (issue.severity === 'feature') console.warn(line);
    else console.info(line);
  }
}

/**
 * Validate environment at server startup — never throws.
 * A missing WORKER_URL or RESEND key must not crash login or /api/health.
 */
export function logWebEnvStatus(): void {
  if (process.env.NEXT_RUNTIME === 'edge') return;

  const issues = collectWebEnvIssues(process.env as Record<string, string | undefined>);

  if (issues.length === 0) {
    console.info('[loyala-web] Environment validation OK');
    return;
  }

  logIssues(issues);

  if (process.env.NODE_ENV === 'production' && !isBuildPhase && hasCriticalWebEnvIssues(issues)) {
    console.error(
      '[loyala-web] Critical environment misconfiguration — auth/CRM may be broken until fixed'
    );
  }
}

/** Structured issues for /api/health — never throws. */
export function getWebEnvDiagnostics(): {
  issues: WebEnvIssue[];
  missingVariables: string[];
  critical: boolean;
  featureDegraded: boolean;
} {
  const issues = collectWebEnvIssues(process.env as Record<string, string | undefined>);
  return {
    issues,
    missingVariables: [...new Set(issues.map((i) => i.variable))],
    critical: hasCriticalWebEnvIssues(issues),
    featureDegraded: issues.some((i) => i.severity === 'feature'),
  };
}
