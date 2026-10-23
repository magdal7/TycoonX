import React from 'react'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
  border?: boolean
}

export function Card({
  children,
  className,
  padding = 'md',
  hover = false,
  border = true,
  ...props
}: CardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-8'
  }
  return (
    <div
      className={`rounded-2xl ${border ? 'border border-line' : ''} bg-surface/60 backdrop-blur-sm ${hover ? 'transition-colors hover:border-primary/40 hover:bg-surface/80' : ''} ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
