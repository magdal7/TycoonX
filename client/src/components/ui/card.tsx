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
      className={`rounded-xl ${border ? 'border border-gray-800' : ''} bg-bg/60 backdrop-blur-sm hover:bg-gray-900/30 ${hover ? 'transition-colors' : ''} ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
