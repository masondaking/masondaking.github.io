const EMAILS_KEY = 'sf:blacklist:emails';
const PWD_HASHES_KEY = 'sf:blacklist:pwdhashes';
const DEMO_SALT = 'dreamscribe_salt';

const unique = (arr: string[]) => Array.from(new Set(arr));

export function readBlacklistedEmails(): string[] {
  try { return JSON.parse(localStorage.getItem(EMAILS_KEY) || '[]'); } catch { return []; }
}
export function readBlacklistedPwdHashes(): string[] {
  try { return JSON.parse(localStorage.getItem(PWD_HASHES_KEY) || '[]'); } catch { return []; }
}
export function addBlacklistedEmail(email: string) {
  const list = readBlacklistedEmails();
  list.push(email.toLowerCase());
  localStorage.setItem(EMAILS_KEY, JSON.stringify(unique(list)));
}
export function removeBlacklistedEmail(email: string) {
  const list = readBlacklistedEmails().filter((e) => e !== email.toLowerCase());
  localStorage.setItem(EMAILS_KEY, JSON.stringify(list));
}
export function addBlacklistedPwdHash(hash: string) {
  const list = readBlacklistedPwdHashes();
  list.push(hash);
  localStorage.setItem(PWD_HASHES_KEY, JSON.stringify(unique(list)));
}
export function removeBlacklistedPwdHash(hash: string) {
  const list = readBlacklistedPwdHashes().filter((h) => h !== hash);
  localStorage.setItem(PWD_HASHES_KEY, JSON.stringify(list));
}
export function isEmailBlacklisted(email: string): boolean {
  return readBlacklistedEmails().includes(email.toLowerCase());
}
export function isPasswordBlacklisted(password: string): boolean {
  const hash = demoHash(password);
  return readBlacklistedPwdHashes().includes(hash);
}

// Hash used by AuthContext in this demo
export function demoHash(password: string): string {
  // btoa may throw on unicode; guard
  try { return btoa(password + DEMO_SALT); } catch { return password + ':' + DEMO_SALT; }
}

