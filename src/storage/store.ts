/**
 * Stockage local uniquement. Aucune donnée ne quitte l'appareil.
 *  - Préférences, questionnaire et habitudes : localStorage (clé « reflet: »).
 *  - Historique des mesures : désactivé par défaut ; s'il est activé, chiffré
 *    (AES-GCM, clé non extractible) dans IndexedDB.
 *  - Les PHOTOS ne sont jamais enregistrées, ni les repères bruts.
 * Si le stockage du navigateur est indisponible (navigation privée, cadre
 * restreint), l'application fonctionne en mémoire pour la session.
 */
import { generateKey, seal, unseal, type Sealed } from "./crypto.js";

const PREFIX = "reflet:";
const DB_NAME = "reflet";
const memory = new Map<string, string>();

function ls(): Storage | null {
  try {
    const s = globalThis.localStorage;
    const probe = PREFIX + "probe";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function persistentStorageAvailable(): boolean {
  return ls() !== null;
}

export function readJSON<T>(key: string, fallback: T): T {
  const raw = ls()?.getItem(PREFIX + key) ?? memory.get(PREFIX + key) ?? null;
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  const raw = JSON.stringify(value);
  const s = ls();
  if (s) {
    try {
      s.setItem(PREFIX + key, raw);
      return;
    } catch {
      /* quota ou interdiction : repli en mémoire */
    }
  }
  memory.set(PREFIX + key, raw);
}

export function removeKey(key: string): void {
  try {
    ls()?.removeItem(PREFIX + key);
  } catch {
    /* ignoré */
  }
  memory.delete(PREFIX + key);
}

// ---------- IndexedDB (historique chiffré) ----------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const r = db.transaction("kv", "readonly").objectStore("kv").get(key);
      r.onsuccess = () => resolve(r.result as T | undefined);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function getKey(): Promise<CryptoKey> {
  const existing = await idbGet<CryptoKey>("key");
  if (existing) return existing;
  const k = await generateKey();
  await idbSet("key", k);
  return k;
}

export async function loadEncrypted<T>(name: string, fallback: T): Promise<T> {
  try {
    const sealed = await idbGet<Sealed>(name);
    if (!sealed) return fallback;
    return await unseal<T>(await getKey(), sealed);
  } catch {
    return fallback;
  }
}

export async function saveEncrypted(name: string, value: unknown): Promise<boolean> {
  try {
    await idbSet(name, await seal(await getKey(), value));
    return true;
  } catch {
    return false;
  }
}

/** Supprime absolument tout ce que Reflet a stocké sur cet appareil. */
export async function wipeEverything(): Promise<void> {
  const s = ls();
  if (s) {
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => s.removeItem(k));
  }
  memory.clear();
  await new Promise<void>((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}
