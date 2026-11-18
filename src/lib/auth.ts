// Dipakai di middleware (Edge) dan server (Node): hanya Web Crypto, tanpa import Next.
export const COOKIE = "nl_session";
export const REG_COOKIE = "nl_reg";
export const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
export const REG_MS = 60 * 60 * 1000;

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Token bertanda tangan: parts.exp.signature */
export async function makeToken(parts: (string | number)[], secret: string, ttlMs: number): Promise<string> {
  const body = [...parts, Date.now() + ttlMs].join(".");
  return `${body}.${await sign(body, secret)}`;
}

/** Mengembalikan parts bila tanda tangan valid dan belum kedaluwarsa, selain itu null. */
export async function readToken(token: string, secret: string): Promise<string[] | null> {
  if (!secret || secret.length < 16) return null;
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const body = token.slice(0, i);
  if (!safeEqual(token.slice(i + 1), await sign(body, secret))) return null;
  const p = body.split(".");
  if (!(Number(p[p.length - 1]) > Date.now())) return null;
  return p.slice(0, -1);
}
