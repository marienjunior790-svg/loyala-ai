import type { ButtonHTMLAttributes } from 'react';
import { cn } from './utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
}

/** Primitive button — shadcn/ui components added Sprint 1 */
export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-[#00C853] text-white hover:opacity-90',
    secondary: 'bg-[#1B3A5C] text-white hover:opacity-90',
    outline: 'border border-[#2A2A2A] bg-transparent hover:bg-[#1E1E1E]',
  };

  return (
    <button
      className={cn(
        'inline-flex min-h-[44px] items-center justify-center rounded-xl px-6 py-2 text-sm font-semibold transition-opacity disabled:opacity-50',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
