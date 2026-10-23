import React from 'react'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'demo' | 'success' | 'warning' | 'gold' | 'danger'
}

export function Badge({
  className,
  variant = 'default',
  children,
  ...props
}: BadgeProps) {
  const base =
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border'
  const variants: Record<string, string> = {
    default: 'border-line text-muted bg-surface-2/50',
    demo: 'border-primary/30 text-primary bg-primary/10',
    success: 'border-success/30 text-success bg-success/10',
    warning: 'border-warning/30 text-warning bg-warning/10',
    gold: 'border-gold/40 text-gold bg-gold/10',
    danger: 'border-danger/30 text-danger bg-danger/10'
  }
  return (
    <span className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  )
}
