/**
 * Chaîne d'entrée d'image dans le navigateur :
 * 1. taille du fichier ; 2. signature binaire ; 3. décodage avec respect de
 * l'orientation EXIF, avec deux solutions de repli ; 4. réduction ;
 * 5. redessin sur un canvas (les métadonnées EXIF/GPS ne sont jamais
 * conservées : seuls les pixels le sont) ; 6. la référence au fichier
 * d'origine est abandonnée. Rien n'est envoyé ni écrit sur le disque.
 */
import { checkFile, dimensionsAcceptable, fitSize, pixelFingerprint, readDimensions, type ImageFormat } from "./validate.js";
import type { RGBAImage } from "../analysis/quality.js";

export const WORK_MAX_SIDE = 1280;

export interface LoadedImage {
  canvas: HTMLCanvasElement;
  pixels: RGBAImage;
  width: number;
  height: number;
  shortSideOriginal: number;
  fingerprint: string;
  format: ImageFormat;
  decoder: string;
}

export class ImageInputError extends Error {}

type Drawable = { source: CanvasImageSource; width: number; height: number; release: () => void; decoder: string };

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** Décodage par <img> et URL blob: dernier recours, compatible avec les anciens Safari. */
function decodeWithImg(file: Blob): Promise<Drawable> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (!img.naturalWidth) {
        URL.revokeObjectURL(url);
        reject(new Error("image vide"));
        return;
      }
      resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url), decoder: "img" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("décodage impossible"));
    };
    img.src = url;
  });
}

async function decode(file: Blob): Promise<Drawable> {
  const attempts: Array<() => Promise<Drawable>> = [];
  if (typeof createImageBitmap === "function") {
    attempts.push(async () => {
      const b = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: b, width: b.width, height: b.height, release: () => b.close(), decoder: "bitmap-exif" };
    });
    attempts.push(async () => {
      const b = await createImageBitmap(file);
      return { source: b, width: b.width, height: b.height, release: () => b.close(), decoder: "bitmap" };
    });
  }
  attempts.push(() => decodeWithImg(file));
  let last: unknown;
  for (const a of attempts) {
    try {
      return await withTimeout(a(), 20000);
    } catch (e) {
      last = e;
    }
  }
  throw last ?? new Error("décodage impossible");
}

export async function loadImageFile(file: File): Promise<LoadedImage> {
  let head: Uint8Array;
  try {
    head = new Uint8Array(await file.slice(0, 512 * 1024).arrayBuffer());
  } catch {
    throw new ImageInputError("Le navigateur n'a pas pu lire ce fichier. Réessayez, ou choisissez la photo depuis la photothèque.");
  }
  const check = checkFile(file.size, head);
  if (!check.ok) throw new ImageInputError(check.error ?? "Fichier refusé.");
  const TOO_BIG = "Les dimensions de cette image sont démesurées (plus de 40 mégapixels) : elle est refusée pour protéger la mémoire de l'appareil.";
  const declared = readDimensions(head, check.format);
  if (declared && !dimensionsAcceptable(declared)) throw new ImageInputError(TOO_BIG);

  let d: Drawable;
  try {
    d = await decode(file);
  } catch {
    if (check.format === "heic") {
      throw new ImageInputError(
        "Ce navigateur ne sait pas lire les photos HEIC. Choisissez la photo depuis « Photothèque » (conversion automatique en JPEG), ou réglez l'iPhone : Réglages › Appareil photo › Formats › « Le plus compatible ».",
      );
    }
    throw new ImageInputError("Impossible de lire cette image : elle est peut-être endommagée ou dans un format non pris en charge.");
  }
  if (!dimensionsAcceptable({ width: d.width, height: d.height })) {
    d.release();
    throw new ImageInputError(TOO_BIG);
  }
  try {
    const shortSideOriginal = Math.min(d.width, d.height);
    const { width, height } = fitSize(d.width, d.height, WORK_MAX_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new ImageInputError("Le navigateur n'a pas pu préparer l'image (mémoire insuffisante ?).");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(d.source, 0, 0, width, height);
    let data: Uint8ClampedArray;
    try {
      data = ctx.getImageData(0, 0, width, height).data;
    } catch {
      throw new ImageInputError("Le navigateur a refusé l'accès aux pixels de l'image.");
    }
    return { canvas, pixels: { width, height, data }, width, height, shortSideOriginal, fingerprint: pixelFingerprint(data, width, height), format: check.format, decoder: d.decoder };
  } finally {
    d.release();
  }
}

/** Efface les pixels d'une image chargée (purge mémoire volontaire). */
export function wipeImage(img: LoadedImage | null | undefined): void {
  if (!img) return;
  const ctx = img.canvas.getContext("2d");
  ctx?.clearRect(0, 0, img.canvas.width, img.canvas.height);
  img.canvas.width = 0;
  img.canvas.height = 0;
  (img.pixels.data as Uint8ClampedArray).fill?.(0);
}
