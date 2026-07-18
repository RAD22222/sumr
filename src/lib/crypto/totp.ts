import { createHmac } from "crypto"

const STEP = 60

function getMasterSecret(): string {
  return process.env.FRIEND_CODE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "fallback"
}

function getUserSecret(userId: string): string {
  return createHmac("sha256", getMasterSecret()).update(userId).digest("hex")
}

function totpForCounter(secret: string, counter: number): string {
  const buf = Buffer.alloc(8)
  buf.writeBigUint64BE(BigInt(counter))

  const hmac = createHmac("sha1", Buffer.from(secret, "hex")).update(buf).digest()

  const offset = hmac[hmac.length - 1] & 0xf
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  return (code % 1000000).toString().padStart(6, "0")
}

export function generateFriendCode(userId: string): string {
  const secret = getUserSecret(userId)
  const counter = Math.floor(Date.now() / 1000 / STEP)
  return totpForCounter(secret, counter)
}

export function getCodeExpiry(): number {
  return STEP - (Math.floor(Date.now() / 1000) % STEP)
}

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
