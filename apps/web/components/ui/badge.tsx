import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-primary/25 bg-primary/15 text-primary',
        secondary: 'border-white/10 bg-white/[0.06] text-secondary-foreground',
        outline: 'border-white/15 text-foreground',
        success: 'border-emerald-400/20 bg-emerald-500/15 text-emerald-300',
        warning: 'border-amber-400/20 bg-amber-500/15 text-amber-300',
        destructive: 'border-destructive/25 bg-destructive/15 text-red-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
