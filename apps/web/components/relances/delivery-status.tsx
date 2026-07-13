import { Badge } from '@/components/ui/badge';
import type { WhatsAppDeliverySnapshot, WhatsAppMessageStatus } from '@loyala/domain-crm';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<WhatsAppMessageStatus, string> = {
  queued: 'En file',
  sent: 'Envoyé',
  delivered: 'Remis',
  read: 'Lu',
  failed: 'Échec',
};

const STATUS_RANK: Record<WhatsAppMessageStatus, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: -1,
};

function formatShortTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function badgeVariant(
  status: WhatsAppMessageStatus
): 'success' | 'warning' | 'destructive' | 'default' | 'secondary' {
  if (status === 'failed') return 'destructive';
  if (status === 'read' || status === 'delivered') return 'success';
  if (status === 'sent') return 'default';
  return 'warning';
}

type StepKey = 'sent' | 'delivered' | 'read';

export function DeliveryStatusTrack({
  delivery,
  className,
}: {
  delivery: WhatsAppDeliverySnapshot;
  className?: string;
}) {
  const rank = STATUS_RANK[delivery.status];
  const steps: Array<{ key: StepKey; label: string; at: string | null }> = [
    { key: 'sent', label: 'Envoyé', at: delivery.sent_at },
    { key: 'delivered', label: 'Remis', at: delivery.delivered_at },
    { key: 'read', label: 'Lu', at: delivery.read_at },
  ];

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={badgeVariant(delivery.status)}>
          {STATUS_LABEL[delivery.status]}
        </Badge>
        {delivery.template_name && (
          <span className="text-[11px] text-muted-foreground">
            Template · {delivery.template_name}
          </span>
        )}
      </div>

      {delivery.status === 'failed' ? (
        <p className="text-xs text-destructive">
          {delivery.error_message ?? 'Échec d’envoi Meta'}
        </p>
      ) : (
        <ol className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {steps.map((step, index) => {
            const stepRank = STATUS_RANK[step.key];
            const done = rank >= stepRank;
            const time = formatShortTime(step.at);
            return (
              <li key={step.key} className="flex items-center gap-1.5">
                {index > 0 && (
                  <span
                    className={cn(
                      'h-px w-3',
                      done ? 'bg-emerald-500/60' : 'bg-border'
                    )}
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
                    done
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-border/60 text-muted-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      done ? 'bg-emerald-400' : 'bg-muted-foreground/40'
                    )}
                    aria-hidden
                  />
                  {step.label}
                  {time ? <span className="opacity-70">· {time}</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function ManualSendBadge({ status }: { status: string }) {
  const sent = status === 'sent';
  return (
    <Badge variant={sent ? 'success' : 'warning'}>
      {sent ? 'Marqué envoyé' : 'À envoyer'}
    </Badge>
  );
}
