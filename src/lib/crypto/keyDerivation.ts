import { arrayBufferToBase64, base64ToArrayBuffer } from "./utils"

export { arrayBufferToBase64, base64ToArrayBuffer }

/**
 * The number of PBKDF2 iterations — kept high to resist brute-force.
 */
const ITERATIONS = 600_000
const KEY_LENGTH = 256

/**
 * Derive a per-user PBKDF2 salt from the userId so that every user has a
 * unique salt without needing to persist one to the database.  We do NOT use a
 * static string because a shared salt completely defeats key-stretching.
 *
 * Strategy: HMAC-SHA256(userId, "sumr-salt-v1") → 32-byte deterministic salt
 * that is unique per user and stable across sessions.
 */
async function deriveUserSalt(userId: string): Promise<Uint8Array<ArrayBuffer>> {
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode("sumr-salt-v1"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", baseKey, enc.encode(userId))
  return new Uint8Array(sig) as Uint8Array<ArrayBuffer>
}

/**
 * Derive an AES-GCM-256 encryption key from the user's master password.
 * The salt is derived from the userId so it is unique per user.
 *
 * @param password  The user's master password (never leaves the device).
 * @param userId    The Supabase user UUID — used to derive a per-user salt.
 */
export async function deriveEncryptionKey(
  password: string,
  userId: string,
): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"],
  )

  const salt = await deriveUserSalt(userId)

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"],
  )
}

/**
 * Generate a fresh random AES-GCM-256 symmetric key for a conversation.
 */
export async function generateConversationKey(): Promise<{
  key: CryptoKey
  raw: ArrayBuffer
}> {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  )
  const raw = await crypto.subtle.exportKey("raw", key)
  return { key, raw }
}

/**
 * Encrypt an ArrayBuffer with the master key.
 * The IV is prepended to the ciphertext so a single base64 blob is stored.
 */
export async function encryptKeyWithMasterKey(
  masterKey: CryptoKey,
  keyToEncrypt: ArrayBuffer,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    masterKey,
    keyToEncrypt,
  )

  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)

  return arrayBufferToBase64(combined.buffer)
}

/**
 * Decrypt a blob previously produced by `encryptKeyWithMasterKey`.
 */
export async function decryptKeyWithMasterKey(
  masterKey: CryptoKey,
  encryptedData: string,
): Promise<ArrayBuffer> {
  const combined = base64ToArrayBuffer(encryptedData)
  const iv = new Uint8Array(combined.slice(0, 12))
  const data = combined.slice(12)

  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, masterKey, data)
}
