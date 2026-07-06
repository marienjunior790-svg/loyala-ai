'use client';

import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildClientRelanceMessage, buildWhatsAppUrl } from '@/lib/whatsapp';

interface WhatsAppRelaunchButtonProps {
  phone: string;
  clientName: string;
  restaurantName?: string;
  size?: 'sm' | 'default';
}

export function WhatsAppRelaunchButton({
  phone,
  clientName,
  restaurantName,
  size = 'sm',
}: WhatsAppRelaunchButtonProps) {
  const message = buildClientRelanceMessage({ clientName, restaurantName });
  const href = buildWhatsAppUrl(phone, message);

  return (
    <Button
      size={size}
      variant="outline"
      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
      asChild
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        <MessageCircle className="h-4 w-4" />
        Relancer
      </a>
    </Button>
  );
}
