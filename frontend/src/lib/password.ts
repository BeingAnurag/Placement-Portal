import { compare, hash } from "bcryptjs";

/**
 * bcryptjs is a pure-JavaScript implementation, so the cost factor is also the
 * request cost: every extra round doubles the time a sign-in blocks a server
 * worker. Ten rounds is the current OWASP floor and lands near a quarter of a
 * second here. Raising it is safe for existing hashes, which carry their own
 * cost in the stored string.
 */
const BCRYPT_COST = 10;

export function hashPassword(plain: string) {
  return hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hashed: string) {
  return compare(plain, hashed);
}
