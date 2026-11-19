"use client";

import { useState } from "react";
import Link from "next/link";
import Brand from "./Logo";

const LINKS = [
  ["#beranda", "Beranda"],
  ["#tentang", "Tentang"],
  ["#fitur", "Fitur"],
  ["#cara-kerja", "Cara Kerja"],
  ["#faq", "FAQ"],
] as const;

export default function LandingNav({ home }: { home: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <nav className="navbar" aria-label="Navigasi utama">
        <Brand href="#beranda" />
        <button className="nav-toggle" type="button" aria-expanded={open} aria-controls="nav-menu" aria-label={open ? "Tutup menu" : "Buka menu"} onClick={() => setOpen(!open)}>
          <svg className="icon-menu" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          <svg className="icon-close" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div className={`nav-menu${open ? " is-open" : ""}`} id="nav-menu">
          <ul className="nav-links">
            {LINKS.map(([href, label]) => (
              <li key={href}><a href={href} onClick={() => setOpen(false)}>{label}</a></li>
            ))}
          </ul>
          <div className="nav-auth">
            {home ? (
              <Link href={home} className="btn primary">Buka Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="btn">Masuk</Link>
                <Link href="/daftar" className="btn primary">Daftar</Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
