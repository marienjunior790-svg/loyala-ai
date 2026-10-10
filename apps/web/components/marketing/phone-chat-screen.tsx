import Image from 'next/image';
import { CheckCheck, ChevronLeft, Gift, Mic, Phone, Plus, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * WhatsApp-style conversation shown on the hero phone. Fixed 248×532 px: the 3D scene maps it
 * onto the phone screen, the static mockup renders it as-is.
 */
export const PHONE_SCREEN_PX = { width: 248, height: 532 } as const;

export function PhoneChatScreen({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative flex h-[532px] w-[248px] select-none flex-col overflow-hidden rounded-[2.1rem] bg-[#06100b] text-white antialiased',
        className
      )}
    >
      <div className="relative flex h-11 shrink-0 items-center justify-between px-6 pt-1 text-[11px] font-semibold">
        <span>18:04</span>
        <span className="absolute left-1/2 top-2 h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-black" />
        <span className="flex items-center gap-1">
          <span className="flex items-end gap-[2px]">
            {[4, 6, 8, 10].map((h) => (
              <span key={h} className="w-[3px] rounded-sm bg-white" style={{ height: h }} />
            ))}
          </span>
          <span className="ml-1 h-[10px] w-[20px] rounded-[3px] border border-white/70 p-[1px]">
            <span className="block h-full w-3/4 rounded-[1px] bg-white" />
          </span>
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] bg-[#0b1912] px-3 pb-2.5 pt-1.5">
        <ChevronLeft className="h-5 w-5 text-[#3DFF95]" />
        <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-black ring-1 ring-[#3DFF95]/40">
          <Image src="/brand/loyala-mark.png" alt="" fill sizes="32px" className="object-contain p-0.5" />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13px] font-semibold">Le Jardin de Dakar</span>
          <span className="block text-[10px] text-[#3DFF95]">en ligne</span>
        </span>
        <Video className="h-4 w-4 text-white/70" />
        <Phone className="ml-2 h-[15px] w-[15px] text-white/70" />
      </div>

      <div
        className="flex flex-1 flex-col justify-end gap-2 px-2 py-2.5 text-[11.5px] leading-snug"
        style={{
          backgroundColor: '#07120c',
          backgroundImage:
            'radial-gradient(circle at 20% 15%, rgba(0,200,83,0.10), transparent 45%), radial-gradient(circle at 85% 80%, rgba(217,174,91,0.07), transparent 40%)',
        }}
      >
        <span className="mx-auto mb-1 rounded-md bg-white/[0.07] px-2 py-0.5 text-[10px] text-white/60">
          Aujourd&apos;hui
        </span>

        <div className="max-w-[88%] self-start rounded-xl rounded-tl-sm bg-[#16241c] px-2.5 py-1.5 shadow-sm">
          Bonjour Awa 👋 Ça fait 3 semaines ! Votre thiéb préféré vous attend ce week-end 🍲
          <span className="mt-0.5 block text-right text-[9px] text-white/45">18:02</span>
        </div>

        <div className="max-w-[80%] self-end rounded-xl rounded-tr-sm bg-[#00A846] px-2.5 py-1.5 shadow-sm">
          Super, je réserve pour samedi, 4 personnes !
          <span className="mt-0.5 flex items-center justify-end gap-0.5 text-[9px] text-white/75">
            18:03 <CheckCheck className="h-3 w-3 text-[#B9FFD6]" />
          </span>
        </div>

        <div className="max-w-[86%] self-start overflow-hidden rounded-xl rounded-tl-sm bg-[#16241c] shadow-sm">
          <div className="flex items-center gap-2 bg-gradient-to-r from-[#D9AE5B]/30 to-[#D9AE5B]/5 px-2.5 py-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#D9AE5B] text-[#2A1C00]">
              <Gift className="h-3.5 w-3.5" />
            </span>
            <span className="leading-tight">
              <span className="block text-[12px] font-semibold text-[#F3D79B]">+50 points fidélité</span>
              <span className="block text-[10px] text-white/60">Palier Or · 450 pts</span>
            </span>
          </div>
          <p className="px-2.5 py-1.5">
            Table confirmée samedi 20h ✅
            <span className="mt-0.5 block text-right text-[9px] text-white/45">18:04</span>
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 bg-[#0b1912] px-2.5 pb-5 pt-2">
        <Plus className="h-5 w-5 text-white/60" />
        <span className="flex-1 rounded-full bg-white/[0.07] px-3 py-1.5 text-[11px] text-white/40">
          Message
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00C853]">
          <Mic className="h-4 w-4 text-black" />
        </span>
      </div>
      <span className="absolute bottom-1.5 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-white/80" />
    </div>
  );
}
