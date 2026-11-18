import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, readToken } from "@/lib/auth";

const PUBLIC = ["/login", "/daftar", "/verifikasi"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE)?.value;
  const parts = token ? await readToken(token, process.env.SESSION_SECRET ?? "") : null;
  const go = (path: string) => {
    const url = req.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    return NextResponse.redirect(url);
  };

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return parts && pathname === "/login" ? go(parts[1] === "admin" ? "/admin" : "/guru") : NextResponse.next();
  }
  if (!parts) return go("/login");
  const role = parts[1];
  if (pathname.startsWith("/admin") && role !== "admin") return go("/guru");
  if (pathname.startsWith("/guru") && role !== "guru") return go("/admin");
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
