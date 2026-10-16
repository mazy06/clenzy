let pendingToken: string | null = null;
/** Retained only in memory while the recipient signs in. */
export function captureInvitation(url: string) {
  const match = url.match(/^(?:clenzy:\/\/|https:\/\/app\.(?:clenzy|baitly)\.fr\/)network-invitation\?token=([a-zA-Z0-9-]{72})$/);
  if (!match) return false;
  pendingToken = match[1]; return true;
}
export function consumeInvitation() {
  const token = pendingToken; pendingToken = null; return token;
}
