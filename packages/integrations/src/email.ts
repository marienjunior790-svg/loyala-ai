export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface EmailResult {
  sent: boolean;
  id?: string;
  skipped?: boolean;
  reason?: string;
}

/** Transactional email via Resend API (when RESEND_API_KEY is set). */
export async function sendTransactionalEmail(input: SendEmailInput): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, skipped: true, reason: 'RESEND_API_KEY not configured' };
  }

  const from = input.from ?? process.env.RESEND_FROM_EMAIL ?? 'Loyala AI <noreply@loyala.ai>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API error: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { id?: string };
  return { sent: true, id: data.id };
}

export async function notifyCampaignReadyByEmail(params: {
  to: string;
  restaurantName: string;
  count: number;
  campaignType: string;
}): Promise<EmailResult> {
  return sendTransactionalEmail({
    to: params.to,
    subject: `Loyala — ${params.count} relance(s) prête(s)`,
    html: `
      <p>Bonjour,</p>
      <p><strong>${params.count}</strong> message(s) ${params.campaignType} ont été générés pour <strong>${params.restaurantName}</strong>.</p>
      <p>Connectez-vous à Loyala pour envoyer via WhatsApp : <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/relances">Voir les relances</a></p>
    `,
  });
}
