// Assemble le site statique dans site/ après la compilation TypeScript (tsc → site/js).
// Copie index.html, la feuille de style et, s'ils sont installés, les fichiers MediaPipe.
import { cpSync, existsSync, mkdirSync, copyFileSync, writeFileSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "site");
mkdirSync(out, { recursive: true });
copyFileSync(join(root, "index.html"), join(out, "index.html"));
copyFileSync(join(root, "styles", "app.css"), join(out, "app.css"));

const vendor = join(root, "public", "vendor", "mediapipe");
const files = existsSync(vendor) ? readdirSync(vendor).filter((f) => !f.startsWith(".")) : [];
if (files.length) {
  cpSync(vendor, join(out, "vendor", "mediapipe"), { recursive: true });
  console.log(`Fichiers MediaPipe copiés (${files.join(", ")}).`);
} else {
  console.log("MediaPipe non installé : l'application fonctionnera en repérage manuel. Voir `npm run setup:vendor`.");
}

// Application installable : manifeste, icônes, service worker (liste des fichiers versionnée).
cpSync(join(root, "public", "icons"), join(out, "icons"), { recursive: true });
copyFileSync(join(root, "public", "manifest.webmanifest"), join(out, "manifest.webmanifest"));
const walk = (dir, base = "") =>
  readdirSync(join(out, dir), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name), `${base}${d.name}/`) : [`${base}${d.name}`]);
// Code et styles dans des chemins propres à CHAQUE version (js-<empreinte>/, app-<empreinte>.css) :
// une ancienne version restée en cache sur un téléphone ne peut plus jamais les remplacer.
const codeHash = createHash("sha256");
for (const f of walk("js", "js/").sort()) codeHash.update(f).update(readFileSync(join(out, f)));
codeHash.update(readFileSync(join(out, "app.css")));
const version = codeHash.digest("hex").slice(0, 12);
for (const d of readdirSync(out)) if (/^js-[0-9a-f]{12}$/.test(d) || /^app-[0-9a-f]{12}\.css$/.test(d)) rmSync(join(out, d), { recursive: true, force: true });
cpSync(join(out, "js"), join(out, `js-${version}`), { recursive: true });
copyFileSync(join(out, "app.css"), join(out, `app-${version}.css`));
writeFileSync(
  join(out, "index.html"),
  readFileSync(join(out, "index.html"), "utf8").replace('src="js/main.js"', `src="js-${version}/main.js"`).replace('href="app.css"', `href="app-${version}.css"`),
);
const shell = ["./", "index.html", `app-${version}.css`, "manifest.webmanifest", ...walk(`js-${version}`, `js-${version}/`).sort(), ...walk("icons", "icons/")]
  .map((f) => (f === "./" ? f : `./${f}`));
writeFileSync(join(out, "sw.js"), readFileSync(join(root, "public", "sw.js"), "utf8").replace("__BUILD_VERSION__", version).replace("__SHELL_FILES__", JSON.stringify(shell)));
console.log(`Service worker généré (version ${version}, ${shell.length} fichiers).`);

// En-têtes de sécurité pour les hébergeurs statiques compatibles (Netlify, Cloudflare Pages).
writeFileSync(
  join(out, "_headers"),
  [
    "/*",
    "  Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    "  Referrer-Policy: no-referrer",
    "  X-Content-Type-Options: nosniff",
    "  Permissions-Policy: camera=(self), microphone=(), geolocation=(), interest-cohort=()",
    "  Cross-Origin-Opener-Policy: same-origin",
    "  Cross-Origin-Resource-Policy: same-origin",
    "  X-Frame-Options: DENY",
    "  Strict-Transport-Security: max-age=31536000; includeSubDomains",
    "",
  ].join("\n"),
);
console.log("Site assemblé dans site/.");
