import type { ReactNode } from "react";
import Nav, { type NavItem } from "./Nav";

export default function Shell({ items, home, sub, children }: { items: NavItem[]; home: string; sub: string; children: ReactNode }) {
  return (
    <div className={sub === "Admin" ? "admin-page" : "guru-page"}>
      <a className="skip-link" href="#konten-utama">Lewati ke konten utama</a>
      <Nav items={items} home={home} sub={sub} />
      <main className="main" id="konten-utama">
        <div className="container">{children}</div>
      </main>
    </div>
  );
}
