import React from 'react'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'demo' | 'success' | 'warning'
}

export function Badge({
  className,
  variant = 'default',
  children,
  ...props
}: BadgeProps) {
  const base =
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border'
  const variants: Record<string, string> = {
    default: 'border-gray-700 text-gray-400 bg-gray-800/30',
    demo: 'border-accent/30 text-accent bg-accent/10',
    success: 'border-success/30 text-success bg-success/10',
    warning: 'border-amber-500/30 text-amber-400 bg-amber-500/10'
  }
  return (
    <span className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  )
}
