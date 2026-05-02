/**
 * Avatar URLs on trip/event cards: prefer matching by member user id to the auth
 * store so the current user's photo updates immediately after upload; fall back
 * to URL equality (prev CDN URL vs list) when `memberId` is missing.
 */

export type ResolveMemberAvatarOpts = {
  memberId?: string;
  currentUserId: string;
  freshUrl: string;
  prevUrl?: string;
};

export function resolveMemberAvatarUri(listUri: string, opts: ResolveMemberAvatarOpts): string {
  const { memberId, currentUserId, freshUrl, prevUrl = '' } = opts;
  if (memberId && currentUserId && memberId === currentUserId && freshUrl) {
    return freshUrl;
  }
  if (!listUri || !freshUrl) return listUri;
  if (prevUrl && listUri === prevUrl) return freshUrl;
  try {
    if (new URL(listUri).pathname === new URL(freshUrl).pathname) return freshUrl;
  } catch {
    /* malformed URL */
  }
  return listUri;
}

/** Stable app user id for comparing to API `user_id` / member `id` fields. */
export function authUserId(user: { id?: string; sub?: string } | null | undefined): string {
  if (!user) return '';
  return String(user.id ?? (user as { sub?: string }).sub ?? '');
}

export function authFreshAvatarUrl(user: { photoUrl?: string; avatarUrl?: string } | null | undefined): string {
  if (!user) return '';
  return user.photoUrl || user.avatarUrl || '';
}
