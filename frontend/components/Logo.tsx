import Link from 'next/link';

/** Wheat-ear mark drawn for AgriDirect; reads on the dark header. */
export function LogoMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <path d="M16 30V9" stroke="#d9541e" strokeWidth="2.2" strokeLinecap="round" />
      <g fill="#d9541e">
        <ellipse cx="16" cy="6" rx="2.6" ry="4.2" />
        <ellipse cx="11.6" cy="12" rx="2.4" ry="3.8" transform="rotate(-35 11.6 12)" />
        <ellipse cx="20.4" cy="12" rx="2.4" ry="3.8" transform="rotate(35 20.4 12)" />
        <ellipse cx="11.6" cy="18.5" rx="2.4" ry="3.8" transform="rotate(-35 11.6 18.5)" />
        <ellipse cx="20.4" cy="18.5" rx="2.4" ry="3.8" transform="rotate(35 20.4 18.5)" />
      </g>
    </svg>
  );
}

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="flex min-h-touch items-center gap-2 text-leaf-800">
      <LogoMark />
      <span className="whitespace-nowrap text-xl font-semibold tracking-tight">
        AgriDirect
      </span>
    </Link>
  );
}
