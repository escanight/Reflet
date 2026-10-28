// Installe les fichiers MediaPipe Face Landmarker en local (auto-hébergement).
// Prérequis : `npm install` (installe @mediapipe/tasks-vision@0.10.21, version figée).
// Le modèle est téléchargé depuis le stockage officiel de Google ; son empreinte
// SHA-256 est affichée pour être consignée et vérifiée lors des déploiements suivants.
//
// NON TESTÉ dans l'environnement où l'application a été écrite (réseau fermé) :
// vérifiez les chemins ci-dessous avec `ls node_modules/@mediapipe/tasks-vision`.
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = join(root, "node_modules", "@mediapipe", "tasks-vision");
const dest = join(root, "public", "vendor", "mediapipe");
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const EXPECTED_SHA256 = process.env.FACE_LANDMARKER_SHA256 ?? null; // à renseigner après le premier téléchargement

if (!existsSync(pkg)) {
  console.error("Paquet @mediapipe/tasks-vision introuvable : lancez d'abord `npm install`.");
  process.exit(1);
}
const version = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8")).version;
console.log(`@mediapipe/tasks-vision ${version}`);

mkdirSync(dest, { recursive: true });
copyFileSync(join(pkg, "vision_bundle.mjs"), join(dest, "vision_bundle.mjs"));
cpSync(join(pkg, "wasm"), join(dest, "wasm"), { recursive: true });
console.log("Bundle JavaScript et fichiers WASM copiés.");

const res = await fetch(MODEL_URL);
if (!res.ok) {
  console.error(`Téléchargement du modèle impossible (${res.status}).`);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
const sha = createHash("sha256").update(buf).digest("hex");
if (EXPECTED_SHA256 && sha !== EXPECTED_SHA256) {
  console.error(`Empreinte inattendue : ${sha} (attendue ${EXPECTED_SHA256}). Abandon.`);
  process.exit(1);
}
writeFileSync(join(dest, "face_landmarker.task"), buf);
writeFileSync(join(dest, "VERSION.txt"), `tasks-vision ${version}\nface_landmarker.task sha256 ${sha}\nsource ${MODEL_URL}\n`);
console.log(`Modèle enregistré (${(buf.length / 1024 / 1024).toFixed(2)} Mo, sha256 ${sha}).`);
console.log("Relancez `npm run build` pour l'inclure dans site/.");
