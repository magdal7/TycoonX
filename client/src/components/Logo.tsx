/**
 * TycoonX brand mark — "TX rising technology tower".
 *
 * An isometric ground plane and a rising gold chevron frame a bold TX monogram,
 * signalling upward architectural movement and a technology-empire identity in
 * emerald and restrained gold. Rendered inline as SVG (crisp at any size, no
 * network request, CSP-safe).
 */
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
      {/* Isometric ground plane */}
      <polygon points="32,50 45,43.5 32,37 19,43.5" fill="#06201a" opacity="0.42" />
      <polygon points="32,48 42,43 32,38 22,43" fill="none" stroke="#D4AF65" strokeWidth="0.9" opacity="0.55" />
      {/* Rising chevron */}
      <path d="M32 9 L41 19 H36.5 V23 H27.5 V19 H23 Z" fill="#D4AF65" />
      {/* T */}
      <g stroke="#F7F1E3" strokeWidth="5.2" strokeLinecap="round" fill="none">
        <path d="M15 27 H26" />
        <path d="M20.5 27 V44" />
      </g>
      {/* X */}
      <g stroke="#F7F1E3" strokeWidth="5.2" strokeLinecap="round" fill="none">
        <path d="M38 27 L48 44" />
        <path d="M48 27 L38 44" />
      </g>
      {/* Horizon */}
      <rect x="15" y="49.5" width="34" height="2.4" rx="1.2" fill="#D4AF65" />
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
