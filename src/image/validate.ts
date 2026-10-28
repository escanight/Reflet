/**
 * Validation d'un fichier image AVANT tout décodage (fonctions pures).
 * Le format est identifié par ses octets de signature, jamais par
 * l'extension ou le type MIME déclaré.
 */

export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export type ImageFormat = "jpeg" | "png" | "webp" | "heic" | "unknown";

export function sniffFormat(head: Uint8Array): ImageFormat {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpeg";
  if (
    head.length >= 8 &&
    head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47 &&
    head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a
  ) return "png";
  if (
    head.length >= 12 &&
    head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
    head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50
  ) return "webp";
  if (head.length >= 12 && head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) {
    const brand = String.fromCharCode(head[8], head[9], head[10], head[11]);
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1", "heim", "heis"].includes(brand)) return "heic";
  }
  return "unknown";
}

export interface FileCheck {
  ok: boolean;
  format: ImageFormat;
  error?: string;
}

export function checkFile(size: number, head: Uint8Array): FileCheck {
  if (size === 0) return { ok: false, format: "unknown", error: "Le fichier est vide." };
  if (size > MAX_FILE_BYTES) {
    return { ok: false, format: "unknown", error: `Le fichier dépasse ${MAX_FILE_BYTES / 1024 / 1024} Mo. Exportez une version plus légère de la photo.` };
  }
  const format = sniffFormat(head);
  if (format === "unknown") {
    return { ok: false, format, error: "Ce fichier n'est pas une image JPEG, PNG, WebP ou HEIC." };
  }
  return { ok: true, format };
}

/** Taille cible : le plus grand côté est ramené à `maxSide` pixels. */
export function fitSize(w: number, h: number, maxSide: number): { width: number; height: number } {
  const s = Math.min(1, maxSide / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
}

/** Empreinte rapide des pixels pour détecter une photo importée deux fois. */
export function pixelFingerprint(data: Uint8ClampedArray | Uint8Array, width: number, height: number): string {
  let h = 2166136261 >>> 0;
  const step = Math.max(1, Math.floor((width * height) / 4096));
  for (let i = 0; i < width * height; i += step) {
    const k = i * 4;
    h ^= (data[k] >> 3) | ((data[k + 1] >> 3) << 5) | ((data[k + 2] >> 3) << 10);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return `${width}x${height}:${h.toString(16)}`;
}

/** Limites anti « bombe de décompression » : un petit fichier peut décrire une image gigantesque. */
export const MAX_PIXELS = 40_000_000;
export const MAX_SIDE = 12_000;

/**
 * Lit les dimensions dans l'en-tête, AVANT tout décodage. Renvoie null si
 * l'en-tête ne permet pas de les lire (le décodage reste alors protégé par
 * le contrôle des dimensions effectué juste après).
 */
export function readDimensions(b: Uint8Array, format: ImageFormat): { width: number; height: number } | null {
  const u16be = (i: number) => (b[i] << 8) | b[i + 1];
  const u32be = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  const u16le = (i: number) => b[i] | (b[i + 1] << 8);
  const u24le = (i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
  if (format === "png" && b.length >= 24) return { width: u32be(16), height: u32be(20) };
  if (format === "jpeg") {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xff) { i += marker === 0xff ? 1 : 2; continue; }
      const len = u16be(i + 2);
      // SOF0..SOF15 sauf DHT (C4), JPG (C8), DAC (CC)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: u16be(i + 5), width: u16be(i + 7) };
      }
      if (len < 2) return null;
      i += 2 + len;
    }
    return null;
  }
  if (format === "webp" && b.length >= 30) {
    const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (chunk === "VP8X") return { width: u24le(24) + 1, height: u24le(27) + 1 };
    if (chunk === "VP8L" && b.length >= 25) {
      const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0;
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8 ") return { width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff };
  }
  return null;
}

export function dimensionsAcceptable(d: { width: number; height: number }): boolean {
  return d.width > 0 && d.height > 0 && d.width <= MAX_SIDE && d.height <= MAX_SIDE && d.width * d.height <= MAX_PIXELS;
}
