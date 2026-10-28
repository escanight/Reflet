// Serveur statique minimal pour le développement et les tests, avec les mêmes
// en-têtes de sécurité que la production. Usage : node scripts/serve.mjs [port]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "site");
const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".wasm": "application/wasm", ".task": "application/octet-stream",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png",
};
const CSP_BASE = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";
// FRAMEABLE=1 : autorise l'intégration dans un cadre (tests qui simulent un hébergeur d'artefacts).
const csp = () => (process.env.FRAMEABLE ? CSP_BASE : `${CSP_BASE}; frame-ancestors 'none'`);

export function startServer(p = port) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
      if (path.endsWith("/")) path += "index.html";
      const file = join(root, path);
      if (!file.startsWith(root)) throw new Error("hors racine");
      const s = await stat(file);
      if (!s.isFile()) throw new Error("pas un fichier");
      res.writeHead(200, {
        "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
        "Content-Security-Policy": csp(),
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
      });
      if (req.method === "HEAD") return res.end();
      res.end(await readFile(file));
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Introuvable");
    }
  });
  return new Promise((resolve) => server.listen(p, "127.0.0.1", () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await startServer();
  console.log(`Reflet : http://127.0.0.1:${port}/`);
}
