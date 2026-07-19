import { createHmac } from "crypto"

/**
 * Time-step in seconds for friend code generation.
 * A code is valid for the current step and one step prior (clock skew tolerance).
 */
const STEP = 60

/**
 * Returns the HMAC secret used to generate per-user friend code secrets.
 *
 * Requires FRIEND_CODE_SECRET to be set in the environment.  We deliberately
 * do NOT fall back to SUPABASE_SERVICE_ROLE_KEY — that key is the database
 * admin credential and must never be used as a HMAC secret or exposed in any
 * other context.
 */
function getMasterSecret(): string {
  const secret = process.env.FRIEND_CODE_SECRET
  if (!secret) {
    throw new Error(
      "FRIEND_CODE_SECRET environment variable is not set. " +
      "Add a random 32+ character secret to your .env.local file.",
    )
  }
  return secret
}

function getUserSecret(userId: string): string {
  return createHmac("sha256", getMasterSecret()).update(userId).digest("hex")
}

function totpForCounter(secret: string, counter: number): string {
  const buf = Buffer.alloc(8)
  buf.writeBigUint64BE(BigInt(counter))

  const hmac = createHmac("sha1", Buffer.from(secret, "hex"))
    .update(buf)
    .digest()

  const offset = hmac[hmac.length - 1] & 0xf
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  return (code % 1_000_000).toString().padStart(6, "0")
}

export function generateFriendCode(userId: string): string {
  const secret = getUserSecret(userId)
  const counter = Math.floor(Date.now() / 1000 / STEP)
  return totpForCounter(secret, counter)
}

export function getCodeExpiry(): number {
  return STEP - (Math.floor(Date.now() / 1000) % STEP)
}

/**
 * Accepts codes from the current time-step and one step prior to handle clock
 * skew between devices.
 */
export function verifyFriendCode(userId: string, code: string): boolean {
  const secret = getUserSecret(userId)
  const currentCounter = Math.floor(Date.now() / 1000 / STEP)

  for (let i = -1; i <= 0; i++) {
    if (totpForCounter(secret, currentCounter + i) === code) {
      return true
    }
  }

  return false
}
