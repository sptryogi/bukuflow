import Link from "next/link";

/** Ikon BukuFlow: buku terbuka + aliran (wave). Dipakai di header, login, dan landing. */
export function BrandIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M4 6.5c4-1.8 8-1.8 12 1V21c-4-2.6-8-2.6-12-.8V6.5z" fill="#fff" />
      <path d="M28 6.5c-4-1.8-8-1.8-12 1V21c4-2.6 8-2.6 12-.8V6.5z" fill="#ffe08a" />
      <path d="M16 8v13" stroke="#4361ee" strokeWidth="1.4" />
      <path d="M3.5 26c2.2-2.4 4.4-2.4 6.6 0s4.4 2.4 6.6 0 4.4-2.4 6.6 0 4.4 2.4 5.2 1.2" stroke="#2ec4b6" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function BrandName() {
  return <span className="brand-name">Buku<strong>Flow</strong></span>;
}

export default function Brand({ href = "/", chip }: { href?: string; chip?: string }) {
  return (
    <Link href={href} className="brand" aria-label="BukuFlow">
      <span className="brand-icon"><BrandIcon /></span>
      <BrandName />
      {chip && <span className="admin-chip">{chip}</span>}
    </Link>
  );
}
