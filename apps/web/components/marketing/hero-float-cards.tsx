import { ArrowUpRight, Gift, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

const CARD =
  'flex items-center gap-3 rounded-2xl border border-white/15 bg-[#0a1610]/75 px-3.5 py-2.5 text-left text-white shadow-[0_18px_40px_-16px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl';

export function ReturnCard({ className }: { className?: string }) {
  return (
    <div className={cn(CARD, 'w-[220px] whitespace-nowrap', className)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3DFF95] to-[#00A846] text-[12px] font-bold text-black">
        AD
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[12px] font-semibold">Awa est revenue</span>
        <span className="block text-[11px] text-white/60">+12 500 XOF ce soir</span>
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-[#3DFF95]" />
    </div>
  );
}

export function CampaignCard({ className }: { className?: string }) {
  return (
    <div className={cn(CARD, 'w-[200px] flex-col items-stretch gap-2', className)}>
      <span className="flex items-center gap-2 text-[12px] font-semibold">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#00C853]/20 text-[#3DFF95]">
          <Send className="h-3.5 w-3.5" />
        </span>
        Relance envoyée
      </span>
      <span className="flex items-end justify-between">
        <span className="text-[22px] font-semibold leading-none">42</span>
        <span className="text-[10px] text-white/55">clients · 94 % lus</span>
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <span className="block h-full w-[94%] rounded-full bg-gradient-to-r from-[#00C853] to-[#3DFF95]" />
      </span>
    </div>
  );
}

export function LoyaltyCard({ className }: { className?: string }) {
  return (
    <div className={cn(CARD, 'w-[180px] border-[#D9AE5B]/30', className)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#F3D79B] to-[#B8892F] text-[#2A1C00]">
        <Gift className="h-4 w-4" />
      </span>
      <span className="leading-tight">
        <span className="block text-[13px] font-semibold text-[#F3D79B]">+50 points</span>
        <span className="block text-[11px] text-white/60">Palier Or atteint</span>
      </span>
    </div>
  );
}
