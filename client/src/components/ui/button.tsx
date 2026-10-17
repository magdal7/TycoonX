import React from 'react'

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'success'
type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  iconLeft?: React.ReactNode
  iconRight?: React.ReactNode
  isLoading?: boolean
}

function variantClass(v: ButtonVariant): string {
  switch (v) {
    case 'primary': return 'bg-primary text-white hover:bg-primary/90'
    case 'outline': return 'border border-gray-600 bg-transparent text-white hover:bg-gray-800/50'
    case 'ghost': return 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
    case 'danger': return 'bg-red-900/20 text-red-400 hover:bg-red-900/40'
    case 'success': return 'bg-success text-white hover:bg-success/90'
    default: return 'bg-primary text-white hover:bg-primary/90'
  }
}

function sizeClass(s: ButtonSize): string {
  switch (s) {
    case 'sm': return 'h-8 px-2 text-xs'
    case 'md': return 'h-10 px-3 py-2 text-sm'
    case 'lg': return 'h-12 px-4 text-base'
    default: return 'h-10 px-3 py-2 text-sm'
  }
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  children,
  iconLeft,
  iconRight,
  isLoading,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variantClass(variant)} ${sizeClass(size)} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {iconLeft && !isLoading && <span className="mr-2">{iconLeft}</span>}
      {children}
      {iconRight && !isLoading && <span className="ml-2">{iconRight}</span>}
    </button>
  )
}
