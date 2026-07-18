const SALT = "sumr-e2ee-v1"
const ITERATIONS = 600000
const KEY_LENGTH = 256

export async function deriveEncryptionKey(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"],
  )

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(SALT),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"],
  )
}

export async function generateConversationKey(): Promise<{ key: CryptoKey; raw: ArrayBuffer }> {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  )
  const raw = await crypto.subtle.exportKey("raw", key)
  return { key, raw }
}

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

export async function decryptKeyWithMasterKey(
  masterKey: CryptoKey,
  encryptedData: string,
): Promise<ArrayBuffer> {
  const combined = base64ToArrayBuffer(encryptedData)
  const iv = new Uint8Array(combined.slice(0, 12))
  const data = combined.slice(12)

  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    masterKey,
    data,
  )
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}
