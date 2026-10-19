export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/icon.svg"
      width={size}
      height={size}
      alt="TycoonX"
      draggable={false}
      className={`select-none rounded-[24%] ${className}`}
    />
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
