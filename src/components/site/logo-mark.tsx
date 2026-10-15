/** The site icon (italic i + cursor, see branding/icon.svg) in theme colours: a foreground tile with a background-coloured mark. */
export function LogoMark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <rect width="100" height="100" rx="18" className="fill-fg" />
      <g className="fill-bg" transform="translate(-4 0)">
        <g transform="translate(10.6 0) skewX(-12)">
          <rect x="36" y="16" width="12" height="12" rx="2" />
          <rect x="36" y="36" width="12" height="48" rx="1.5" />
        </g>
        <rect x="57" y="78" width="23" height="6" rx="1" />
      </g>
    </svg>
  );
}
