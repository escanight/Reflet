/**
 * Chiffrement local AES-GCM 256 bits (Web Crypto). La clé est générée sur
 * l'appareil, marquée non extractible, et ne quitte jamais le navigateur.
 *
 * Portée réelle : protège l'historique contre une lecture directe des
 * fichiers du navigateur (sauvegarde, copie du profil), pas contre une
 * personne qui utilise le navigateur déverrouillé.
 */

export interface Sealed {
  v: 1;
  iv: string;
  data: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function seal(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(value)));
  return { v: 1, iv: toB64(iv), data: toB64(new Uint8Array(data)) };
}

export async function unseal<T>(key: CryptoKey, sealed: Sealed): Promise<T> {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(sealed.iv) }, key, fromB64(sealed.data));
  return JSON.parse(dec.decode(plain)) as T;
}
