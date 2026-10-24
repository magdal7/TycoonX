export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="TycoonX"
      className={`select-none ${className}`}
    >
      <rect width="64" height="64" rx="15" fill="#091916" />
      <rect x="4.5" y="4.5" width="55" height="55" rx="12.5" fill="#10B981" />
      <rect x="7.5" y="7.5" width="49" height="49" rx="10" fill="none" stroke="#D4AF65" strokeWidth="1.2" opacity="0.8" />
      <g stroke="#F7F1E3" strokeWidth="5.5" strokeLinecap="round" fill="none">
        <path d="M15 22 H29" />
        <path d="M22 22 V44" />
        <path d="M35 22 L49 44" />
        <path d="M49 22 L35 44" />
      </g>
      <rect x="15" y="50" width="34" height="2.5" rx="1.25" fill="#D4AF65" />
    </svg>
  )
}

export function Logo({
  size = 32,
  showWord = true,
  className = '',
  wordClassName = ''
}: {
  size?: number
  showWord?: boolean
  className?: string
  wordClassName?: string
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      {showWord && (
        <span className={`text-lg font-black tracking-tighter text-gradient ${wordClassName}`}>TycoonX</span>
      )}
    </span>
  )
}
