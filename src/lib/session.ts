import type { Session } from "../types.ts";

const COOKIE = "humane";
const MAX_AGE = 60 * 60 * 24 * 365;

export function defaultSecret(): string {
  return "local-dev-session-secret-not-for-prod";
}

export async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToHex(new Uint8Array(sig));
}

export async function verify(secret: string, payload: string, mac: string): Promise<boolean> {
  const expected = await sign(secret, payload);
  if (expected.length !== mac.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ mac.charCodeAt(i);
  return diff === 0;
}

export async function encodeSession(secret: string, session: Session): Promise<string> {
  const payload = `${session.id}.${session.playerId ?? ""}`;
  const mac = await sign(secret, payload);
  return `v1.${payload}.${mac}`;
}

export async function decodeSession(secret: string, token: string | null): Promise<Session | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const [, id, playerId, mac] = parts;
  if (!id || !mac) return null;
  const payload = `${id}.${playerId}`;
  if (!(await verify(secret, payload, mac))) return null;
  return { id, playerId: playerId || null };
}

export function readCookie(header: string | null, name = COOKIE): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function sessionCookie(token: string, secure: boolean): string {
  const flags = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${MAX_AGE}`,
  ];
  if (secure) flags.push("Secure");
  return flags.join("; ");
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}
