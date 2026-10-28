/**
 * Viseur de scan : caméra en direct, ovale de cadrage, retardateur, bascule
 * avant/arrière, accès galerie, et capture en rafale (3 images) pour mesurer
 * la répétabilité. Le flux reste local et s'éteint dès la capture, en
 * quittant l'écran ou quand l'app passe en arrière-plan.
 */
import { h, announce } from "./dom.js";
import { icon } from "./components.js";

export type CameraError = "unsupported" | "denied" | "blocked" | "notfound" | "busy" | "unknown";

export function cameraSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export function classifyCameraError(e: unknown): CameraError {
  const name = (e as { name?: string })?.name ?? "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return "denied";
  if (name === "SecurityError") return "blocked";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") return "notfound";
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "busy";
  return "unknown";
}

export const CAMERA_ERROR_TEXT: Record<CameraError, string> = {
  unsupported: "Ton navigateur ne donne pas accès à la caméra. Choisis une photo dans ta galerie.",
  denied: "Accès à la caméra refusé. Autorise-le dans les réglages du navigateur (icône à gauche de l'adresse), ou choisis une photo.",
  blocked: "L'application qui affiche Reflet bloque la caméra. Ouvre Reflet installée sur ton écran d'accueil, ou choisis une photo.",
  notfound: "Aucune caméra trouvée sur cet appareil.",
  busy: "La caméra est utilisée par une autre application. Ferme-la et réessaie.",
  unknown: "La caméra n'a pas pu démarrer. Réessaie ou choisis une photo.",
};

export const BURST = { frames: 3, intervalMs: 280 } as const;

export interface CameraOptions {
  distance: "near" | "far";
  onDistance: (d: "near" | "far") => void;
  onCapture: (files: File[]) => void;
  onGallery: (file: File) => void;
  onError: (err: CameraError) => void;
}

async function frameToFile(video: HTMLVideoElement, i: number): Promise<File | null> {
  const c = document.createElement("canvas");
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  // L'aperçu est en miroir pour être naturel ; la photo, elle, n'est pas inversée.
  ctx.drawImage(video, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.92));
  c.width = c.height = 0;
  return blob ? new File([blob], `scan-${i + 1}.jpg`, { type: "image/jpeg" }) : null;
}

export function galleryInput(onFile: (f: File) => void, testid = "file-gallery"): HTMLInputElement {
  const input = h("input", { type: "file", accept: "image/*", class: "file-overlay", "aria-label": "Choisir une photo dans la galerie", "data-testid": testid });
  input.addEventListener("change", () => {
    const f = input.files?.[0];
    if (f) onFile(f);
    input.value = "";
  });
  return input;
}

export function createCamera(opts: CameraOptions): { element: HTMLElement; stop: () => void } {
  let stream: MediaStream | null = null;
  let facing: "user" | "environment" = "user";
  let countdown: number | undefined;
  let stopped = false;
  let busy = false;
  let distance = opts.distance;

  const video = h("video", { class: "camera-video", playsinline: true, muted: true, autoplay: true, "aria-label": "Aperçu de la caméra" });
  video.muted = true;
  video.playsInline = true;
  const counter = h("div", { class: "camera-count", "aria-live": "assertive" });
  const flash = h("div", { class: "camera-flash" });
  const hint = h("p", { class: "camera-hint", role: "status" }, "Démarrage de la caméra…");

  const distBtn = h("button", { type: "button", class: "chip", "aria-pressed": "false" });
  const renderDist = () => {
    distBtn.replaceChildren(icon("scan", 14), distance === "far" ? "Posé à ~1,5 m" : "Bras tendu");
    distBtn.setAttribute("aria-label", `Distance : ${distance === "far" ? "téléphone posé à environ 1,5 mètre" : "bras tendu"}. Toucher pour changer.`);
  };
  renderDist();
  distBtn.addEventListener("click", () => {
    distance = distance === "far" ? "near" : "far";
    opts.onDistance(distance);
    renderDist();
  });
  const timerBtn = h("button", { type: "button", class: "chip", "aria-label": "Retardateur de 10 secondes" }, icon("calendar", 14), "10 s");
  timerBtn.addEventListener("click", () => timed(10));

  const stage = h(
    "div",
    { class: "camera-stage" },
    video,
    h("div", { class: "camera-guide", "aria-hidden": "true" }, h("div", { class: "camera-oval" })),
    h("div", { class: "camera-top" }, distBtn, timerBtn),
    counter,
    flash,
  );

  const onHidden = () => {
    if (document.visibilityState === "hidden" && !stopped) stop();
  };
  document.addEventListener("visibilitychange", onHidden);

  function stop(): void {
    stopped = true;
    document.removeEventListener("visibilitychange", onHidden);
    window.clearInterval(countdown);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
  }

  async function start(): Promise<void> {
    stream?.getTracks().forEach((t) => t.stop());
    stopped = false;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      });
    } catch (e) {
      // Caméra déjà abandonnée (photo choisie dans la galerie entre-temps) : l'erreur ne concerne plus personne.
      if (stopped) return;
      stop();
      opts.onError(classifyCameraError(e));
      return;
    }
    if (stopped) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    video.srcObject = stream;
    video.classList.toggle("mirrored", facing === "user");
    try {
      await video.play();
    } catch {
      /* lecture automatique refusée : démarrera au premier geste */
    }
    hint.textContent = "Visage dans l'ovale · tête droite · lumière de face";
  }

  async function capture(): Promise<void> {
    if (busy) return;
    if (!stream || !video.videoWidth) {
      hint.textContent = "La caméra n'est pas encore prête.";
      return;
    }
    busy = true;
    const files: File[] = [];
    for (let i = 0; i < BURST.frames; i++) {
      flash.classList.remove("on");
      void flash.offsetWidth;
      flash.classList.add("on");
      const f = await frameToFile(video, i);
      if (f) files.push(f);
      if (i < BURST.frames - 1) await new Promise((r) => setTimeout(r, BURST.intervalMs));
    }
    stop();
    busy = false;
    if (!files.length) {
      opts.onError("unknown");
      return;
    }
    announce("Photos prises, analyse en cours.");
    opts.onCapture(files);
  }

  function timed(seconds: number): void {
    window.clearInterval(countdown);
    let left = seconds;
    counter.textContent = String(left);
    countdown = window.setInterval(() => {
      left--;
      if (left <= 0) {
        window.clearInterval(countdown);
        counter.textContent = "";
        void capture();
      } else counter.textContent = String(left);
    }, 1000);
  }

  const gallery = h(
    "div",
    { class: "round-btn", title: "Galerie" },
    icon("image", 22),
    galleryInput((f) => {
      stop();
      opts.onGallery(f);
    }),
  );
  const flip = h("button", { type: "button", class: "round-btn", "aria-label": "Changer de caméra" }, icon("undo", 22));
  flip.addEventListener("click", () => {
    facing = facing === "user" ? "environment" : "user";
    void start();
  });
  const shutter = h("button", { type: "button", class: "shutter", "aria-label": "Lancer le scan" }, h("span"));
  shutter.addEventListener("click", () => void capture());

  const element = h("div", { class: "camera" }, stage, hint, h("div", { class: "camera-controls" }, gallery, shutter, flip));
  void start();
  return { element, stop };
}
