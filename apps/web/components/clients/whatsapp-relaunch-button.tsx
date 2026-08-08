'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Loader2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { relaunchClientWhatsAppAction } from '@/app/(dashboard)/clients/_actions/relaunch';

interface WhatsAppRelaunchButtonProps {
  clientId: string;
  phone: string;
  clientName: string;
  restaurantName?: string;
  whatsappReady: boolean;
  size?: 'sm' | 'default';
}

export function WhatsAppRelaunchButton({
  clientId,
  whatsappReady,
  size = 'sm',
}: WhatsAppRelaunchButtonProps) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [needsConnect, setNeedsConnect] = useState(false);

  if (!whatsappReady) {
    return (
      <div className="flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Button size={size} variant="outline" asChild className="border-amber-500/40 text-amber-200">
          <Link href="/settings">
            <MessageCircle className="h-4 w-4" />
            Connecter WhatsApp
          </Link>
        </Button>
        <p className="max-w-[11rem] text-right text-[10px] text-muted-foreground">
          WhatsApp Business n’est pas encore connecté.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
      <Button
        size={size}
        variant="outline"
        disabled={pending}
        className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
        onClick={() =>
          start(async () => {
            setMsg(null);
            setNeedsConnect(false);
            const res = await relaunchClientWhatsAppAction(clientId);
            if (res.needsConnect) setNeedsConnect(true);
            setMsg(res.error ?? res.success ?? null);
          })
        }
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
        Relancer
      </Button>
      {needsConnect && (
        <Link href="/settings" className="text-[10px] text-primary underline">
          Connecter WhatsApp
        </Link>
      )}
      {msg && (
        <p
          className={`max-w-[14rem] text-right text-[10px] ${
            msg.includes('envoyée') ? 'text-emerald-400' : 'text-muted-foreground'
          }`}
        >
          {msg}
        </p>
      )}
    </div>
  );
}
