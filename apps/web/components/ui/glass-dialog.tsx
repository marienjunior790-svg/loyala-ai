'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZES = {
  sm: 'sm:max-w-[26rem]',
  md: 'sm:max-w-[32rem]',
  lg: 'sm:max-w-[34rem]',
  xl: 'sm:max-w-[46rem]',
  '2xl': 'sm:max-w-3xl',
} as const;

export interface GlassDialogProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  icon?: React.ReactNode;
  size?: keyof typeof SIZES;
  /** `sheet` docks the dialog to the bottom edge on small screens. */
  placement?: 'center' | 'sheet';
  /** When false, clicks on the scrim are ignored (Esc and the close button still work). */
  dismissOnOutsideClick?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function GlassDialog({
  open,
  onClose,
  title,
  description,
  eyebrow,
  icon,
  size = 'md',
  placement = 'center',
  dismissOnOutsideClick = true,
  className,
  children,
}: GlassDialogProps) {
  const sheet = placement === 'sheet';
  const blockOutside = (e: Event) => {
    if (!dismissOnOutsideClick) e.preventDefault();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-[60] grid overflow-y-auto bg-black/55 backdrop-blur-[6px]',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-200',
            sheet ? 'items-end justify-items-center sm:place-items-center sm:p-4' : 'place-items-center p-4'
          )}
        >
          <DialogPrimitive.Content
            {...(description ? {} : { 'aria-describedby': undefined })}
            onPointerDownOutside={blockOutside}
            onInteractOutside={blockOutside}
            className={cn(
              'glass-strong flex max-h-[92vh] w-full flex-col overflow-hidden text-foreground focus:outline-none',
              'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-300',
              sheet
                ? 'rounded-t-3xl data-[state=open]:slide-in-from-bottom-6 sm:rounded-3xl sm:data-[state=open]:zoom-in-95 sm:data-[state=open]:slide-in-from-bottom-0'
                : 'rounded-3xl data-[state=open]:zoom-in-95',
              SIZES[size],
              className
            )}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.08] px-6 py-4">
              <div className="flex min-w-0 items-start gap-3">
                {icon && (
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25 [&_svg]:h-[1.125rem] [&_svg]:w-[1.125rem]">
                    {icon}
                  </span>
                )}
                <div className="min-w-0">
                  {eyebrow && (
                    <p className="text-xs font-medium uppercase tracking-wide text-primary">{eyebrow}</p>
                  )}
                  <DialogPrimitive.Title
                    className={cn('truncate text-lg font-semibold tracking-tight', eyebrow && 'mt-1')}
                  >
                    {title}
                  </DialogPrimitive.Title>
                  {description && (
                    <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                      {description}
                    </DialogPrimitive.Description>
                  )}
                </div>
              </div>
              <DialogPrimitive.Close
                className="shrink-0 rounded-full p-1.5 text-muted-foreground transition hover:bg-white/[0.08] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>
            {children}
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Scrollable middle section of a GlassDialog. */
export function GlassDialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-5', className)} {...props} />;
}

/** Sticky action row at the bottom of a GlassDialog. */
export function GlassDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex shrink-0 flex-wrap items-center gap-2 border-t border-white/[0.08] px-6 py-4', className)}
      {...props}
    />
  );
}
