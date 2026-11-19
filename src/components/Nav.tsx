"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/actions/auth";
import Brand from "./Logo";

const P: Record<string, string> = {
  home: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  building: "M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 10h4a1 1 0 0 1 1 1v10M3 21h18M8 8h3M8 12h3M8 16h3",
  users: "M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-1a4 4 0 0 0-3-3.9M16 4.1a3.5 3.5 0 0 1 0 6.8",
  book: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
};

export type NavItem = { href: string; label: string; icon: keyof typeof P };

export default function Nav({ items, home, sub }: { items: NavItem[]; home: string; sub: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <nav className="navbar" aria-label="Menu utama">
        <Brand href={home} chip={sub === "Admin" ? "Admin" : undefined} />
        <button className="nav-toggle" type="button" aria-expanded={open} aria-controls="nav-menu" aria-label={open ? "Tutup menu" : "Buka menu"} onClick={() => setOpen(!open)}>
          <svg className="icon-menu" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          <svg className="icon-close" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div className={`nav-menu${open ? " is-open" : ""}`} id="nav-menu">
          <ul className="nav-links">
            {items.map((it) => {
              const active = it.href === home ? path === home : path.startsWith(it.href);
              return (
                <li key={it.href}>
                  <Link href={it.href} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[it.icon]} /></svg>
                    <span>{it.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="nav-auth">
            <form action={logout}><button className="btn primary sm">Keluar</button></form>
          </div>
        </div>
      </nav>
    </header>
  );
}
