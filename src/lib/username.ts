import { isReserved } from "./reserved.ts";

export type UsernameError = "too_short" | "too_long" | "bad_chars" | "reserved";

export interface UsernameCheck {
  ok: boolean;
  norm: string;
  display: string;
  error?: UsernameError;
}

const RE = /^[a-z0-9_]{3,16}$/i;

export function checkUsername(raw: string): UsernameCheck {
  const display = raw.trim();
  if (display.length < 3) return { ok: false, norm: "", display, error: "too_short" };
  if (display.length > 16) return { ok: false, norm: "", display, error: "too_long" };
  if (!RE.test(display)) return { ok: false, norm: "", display, error: "bad_chars" };
  const norm = display.toLowerCase();
  if (isReserved(norm)) return { ok: false, norm, display: display.toLowerCase(), error: "reserved" };
  return { ok: true, norm, display: display.toLowerCase() };
}

export function usernameMessage(error: UsernameError): string {
  switch (error) {
    case "too_short":
      return "Three characters is the floor.";
    case "too_long":
      return "Sixteen characters is the ceiling.";
    case "bad_chars":
      return "Letters, numbers, underscore. Nothing else.";
    case "reserved":
      return "That name is spoken for.";
  }
}
