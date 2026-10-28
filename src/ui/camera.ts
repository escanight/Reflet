/**
 * Caméra intégrée : viseur en direct, guide ovale, retardateur, bascule
 * avant/arrière. La photo est prise dans la page (getUserMedia) puis passe
 * par la même chaîne de validation que les fichiers importés.
 *
 * Le flux vidéo reste local : il n'est ni enregistré ni transmis, et la
 * caméra est éteinte dès la capture ou dès que l'on quitte l'écran.
 *
 * Certaines visionneuses intégrées interdisent la caméra à toute page web
 * qu'elles affichent : l'erreur est alors détectée et expliquée, sans
 * contournement possible depuis la page.
 */
import { h, announce } from "./dom.js";
import { button, icon, notice } from "./components.js";

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
  unsupported: "Ce navigateur ne permet pas d'utiliser la caméra dans une page web.",
  denied: "L'accès à la caméra a été refusé. Autorisez-le dans les réglages du site (icône à gauche de l'adresse), ou par le réglage de l'application qui affiche Reflet.",
  blocked: "L'application qui affiche Reflet interdit l'accès à la caméra pour les pages qu'elle affiche. Ce blocage ne peut pas être levé depuis Reflet : utilisez « Choisir une photo », ou ouvrez Reflet installée sur votre écran d'accueil.",
  notfound: "Aucune caméra n'a été trouvée sur cet appareil.",
  busy: "La caméra est déjà utilisée par une autre application. Fermez-la, puis réessayez.",
  unknown: "La caméra n'a pas pu démarrer.",
};

export interface CameraOptions {
  onCapture: (file: File) => void;
  onCancel: () => void;
  onError: (err: CameraError) => void;
}

/** Monte le viseur ; renvoie l'élément et une fonction d'arrêt (à appeler en quittant l'écran). */
export function createCamera(opts: CameraOptions): { element: HTMLElement; stop: () => void } {
  let stream: MediaStream | null = null;
  let facing: "user" | "environment" = "user";
  let countdown: number | undefined;
  let stopped = false;

  const video = h("video", { class: "camera-video", playsinline: true, muted: true, autoplay: true, "aria-label": "Aperçu de la caméra" });
  video.muted = true;
  video.playsInline = true;
  const guide = h("div", { class: "camera-guide", "aria-hidden": "true" }, h("div", { class: "camera-oval" }));
  const counter = h("div", { class: "camera-count", "aria-live": "assertive" });
  const status = h("p", { class: "muted small camera-status", role: "status" }, "Démarrage de la caméra…");
  const stage = h("div", { class: "camera-stage" }, video, guide, counter);

  // Confidentialité : la caméra s'éteint dès que l'application passe en arrière-plan.
  const onHidden = () => {
    if (document.visibilityState === "hidden" && !stopped) {
      stop();
      opts.onCancel();
    }
  };
  document.addEventListener("visibilitychange", onHidden);

  const stop = () => {
    stopped = true;
    document.removeEventListener("visibilitychange", onHidden);
    window.clearInterval(countdown);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
  };

  async function start(): Promise<void> {
    stream?.getTracks().forEach((t) => t.stop());
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      });
    } catch (e) {
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
      /* lecture automatique refusée : la vidéo démarrera au premier geste */
    }
    status.textContent = "Placez votre visage dans l'ovale, tête droite, à hauteur des yeux.";
  }

  async function capture(): Promise<void> {
    if (!stream || !video.videoWidth) {
      status.textContent = "La caméra n'est pas encore prête.";
      return;
    }
    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // L'aperçu est en miroir pour être naturel ; la photo, elle, n'est pas inversée.
    ctx.drawImage(video, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.92));
    c.width = c.height = 0;
    stop();
    if (!blob) {
      opts.onError("unknown");
      return;
    }
    announce("Photo prise.");
    opts.onCapture(new File([blob], "camera.jpg", { type: "image/jpeg" }));
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

  const element = h(
    "div",
    { class: "camera" },
    stage,
    status,
    h(
      "div",
      { class: "camera-controls" },
      button("Retourner", () => {
        facing = facing === "user" ? "environment" : "user";
        void start();
      }, { variant: "quiet", icon: "undo" }),
      h("button", { type: "button", class: "shutter", title: "Prendre la photo", "aria-label": "Prendre la photo", onclick: (() => void capture()) as EventListener }, h("span")),
      (() => { const b = button("10 s", () => timed(10), { variant: "quiet", icon: "calendar" }); b.setAttribute("aria-label", "Retardateur de 10 secondes"); return b; })(),
    ),
    h("p", { class: "muted small" }, icon("info", 14), " Conseil : posez le téléphone à environ 1,5 m, lancez le retardateur, et placez-vous face à une fenêtre."),
    h("div", { class: "button-row" }, button("Annuler", () => {
      stop();
      opts.onCancel();
    }, { variant: "ghost" })),
  );
  void start();
  return { element, stop };
}

export function cameraErrorNotice(err: CameraError): HTMLElement {
  return notice(err === "blocked" || err === "unsupported" ? "info" : "warn", h("p", null, CAMERA_ERROR_TEXT[err]));
}
