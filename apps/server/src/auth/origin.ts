/** Origin check for the WebSocket upgrade and state-changing REST calls (ADR-0018). */
export function isAllowedOrigin(origin: string | undefined, allowed: string): boolean {
  return origin !== undefined && origin === allowed;
}

/** Read one cookie value from a Cookie header. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i !== -1 && part.slice(0, i).trim() === name) {
      return decodeURIComponent(part.slice(i + 1).trim());
    }
  }
  return undefined;
}
