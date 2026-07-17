/**
 * Returns `path` only when it's a safe place to send a user *after* signing in:
 * a same-origin, absolute path that isn't itself part of the auth flow. Anything
 * else — an external or protocol-relative URL (`//evil.com`), an auth page, or a
 * blank value — yields `null` so the caller can fall back to a default landing.
 *
 * This is the open-redirect guard shared by the sign-in redirect mechanism
 * (auth guard, public guard, login/register, RedirectService).
 */
export function internalReturnUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (!path.startsWith('/') || path.startsWith('//')) return null; // internal only, never protocol-relative
  if (path === '/auth' || path.startsWith('/auth/')) return null;  // never bounce back into the auth flow
  return path;
}
