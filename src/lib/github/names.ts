// Plain checks with no zod import, so client code (the repo search box) can
// validate names without pulling the schema library into every page.

/** GitHub usernames/orgs: alphanumerics and single hyphens, max 39 chars. */
export function isValidOwner(s: string) {
  return /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(s);
}

/** Repository names: letters, digits, '.', '-', '_' (not '.' or '..'). */
export function isValidRepoName(s: string) {
  return /^[A-Za-z0-9._-]{1,100}$/.test(s) && s !== "." && s !== "..";
}
