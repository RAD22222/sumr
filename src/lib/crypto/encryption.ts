import {
  deriveEncryptionKey,
  generateConversationKey,
  encryptKeyWithMasterKey,
  decryptKeyWithMasterKey,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from "./keyDerivation"

import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  encryptWithPublicKey,
  decryptWithPrivateKey,
} from "./keyExchange"

export interface EncryptedPayload {
  encrypted_content: string
  nonce: string
}

export class E2EEManager {
  private masterKey: CryptoKey | null = null
  private rsaPrivateKey: CryptoKey | null = null
  private rsaPublicKey: CryptoKey | null = null

  async initialize(password: string): Promise<void> {
    this.masterKey = await deriveEncryptionKey(password)
  }

  isInitialized(): boolean {
    return this.masterKey !== null
  }

  async createKeys(): Promise<{
    publicKey: string
    encryptedPrivateKey: string
  }> {
    if (!this.masterKey) throw new Error("E2EE not initialized")

    const keyPair = await generateKeyPair()
    this.rsaPublicKey = keyPair.publicKey
    this.rsaPrivateKey = keyPair.privateKey

    const publicKey = await exportPublicKey(keyPair.publicKey)
    const exportedPrivate = await crypto.subtle.exportKey(
      "pkcs8",
      keyPair.privateKey,
    )
    const encryptedPrivateKey = await encryptKeyWithMasterKey(
      this.masterKey,
      exportedPrivate,
    )

    return { publicKey, encryptedPrivateKey }
  }

  async loadKeys(
    encryptedPrivateKeyBase64: string,
    publicKeyBase64: string,
  ): Promise<void> {
    if (!this.masterKey) throw new Error("E2EE not initialized")

    const raw = await decryptKeyWithMasterKey(
      this.masterKey,
      encryptedPrivateKeyBase64,
    )
    this.rsaPrivateKey = await crypto.subtle.importKey(
      "pkcs8",
      raw,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["decrypt"],
    )

    this.rsaPublicKey = await importPublicKey(publicKeyBase64)
  }

  async createConversationKey(
    otherUserPublicKeyBase64: string,
  ): Promise<{
    raw: string
    encryptedForSelf: string
    encryptedForOther: string
  }> {
    if (!this.masterKey) throw new Error("E2EE not initialized")

    const { raw } = await generateConversationKey()
    const encryptedForSelf = await encryptKeyWithMasterKey(this.masterKey, raw)

    const otherPublicKey = await importPublicKey(otherUserPublicKeyBase64)
    const encryptedForOther = await encryptWithPublicKey(otherPublicKey, raw)

    return {
      raw: arrayBufferToBase64(raw),
      encryptedForSelf,
      encryptedForOther,
    }
  }

  async decryptConversationKeyForOther(
    encryptedForOther: string,
  ): Promise<string> {
    if (!this.rsaPrivateKey) throw new Error("RSA key not loaded")

    const raw = await decryptWithPrivateKey(
      this.rsaPrivateKey,
      encryptedForOther,
    )
    return arrayBufferToBase64(raw)
  }

  async encryptMessage(
    conversationKeyRaw: string,
    content: string,
  ): Promise<EncryptedPayload> {
    const raw = base64ToArrayBuffer(conversationKeyRaw)
    const key = await crypto.subtle.importKey(
      "raw",
      raw,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"],
    )

    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(content)

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoded,
    )

    return {
      encrypted_content: arrayBufferToBase64(encrypted),
      nonce: arrayBufferToBase64(iv.buffer),
    }
  }

  async decryptMessage(
    conversationKeyRaw: string,
    encryptedContent: string,
    nonce: string,
  ): Promise<string> {
    const raw = base64ToArrayBuffer(conversationKeyRaw)
    const key = await crypto.subtle.importKey(
      "raw",
      raw,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    )

    const encrypted = base64ToArrayBuffer(encryptedContent)
    const iv = new Uint8Array(base64ToArrayBuffer(nonce))

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encrypted,
    )

    return new TextDecoder().decode(decrypted)
  }

  async getConversationKey(encryptedSymmetricKey: string): Promise<string> {
    if (!this.masterKey) throw new Error("E2EE not initialized")

    const raw = await decryptKeyWithMasterKey(
      this.masterKey,
      encryptedSymmetricKey,
    )
    return arrayBufferToBase64(raw)
  }

  clear(): void {
    this.masterKey = null
    this.rsaPrivateKey = null
    this.rsaPublicKey = null
  }
}

export const e2ee = new E2EEManager()
