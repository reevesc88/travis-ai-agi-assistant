export type UserRole = "owner" | "tech" | string;

export interface TokenPayload {
  email?: string;
  role?: UserRole;
  exp?: number;
}

export function parseTokenPayload(): TokenPayload | null {
  const token = localStorage.getItem("travis_token");
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as TokenPayload;
  } catch {
    return null;
  }
}

export function getCurrentRole(): UserRole | null {
  return parseTokenPayload()?.role ?? null;
}

export function isOwner(): boolean {
  return getCurrentRole() === "owner";
}

export function isTech(): boolean {
  return getCurrentRole() === "tech";
}
