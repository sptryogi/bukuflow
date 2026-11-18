import type { ReactNode } from "react";
import Nav, { type NavItem } from "./Nav";
import { logout } from "@/app/actions/auth";

export default function Shell({ items, home, sub, children }: { items: NavItem[]; home: string; sub: string; children: ReactNode }) {
  return (
    <div>
      <Nav items={items} home={home} sub={sub} />
      <div className="topbar">
        <span className="logo">N</span>
        <strong className="grow">NusaLiterasi</strong>
        <form action={logout}>
          <button className="btn sm">Keluar</button>
        </form>
      </div>
      <main className="main">
        <div className="container">{children}</div>
      </main>
    </div>
  );
}
