// Partition local drafts when the temporary/login token changes; never use a
// credential itself in a storage key. This fingerprint is not authentication.
export function tokenScope(token: string) {
  let hash = 2166136261
  for (const char of token) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0
  return token ? hash.toString(16).padStart(8, '0') : 'anonymous'
}
