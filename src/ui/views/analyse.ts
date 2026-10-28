import { clear, h, announce } from "../dom.js";
import { button, card, checkbox, choiceGroup, details, icon, linkButton, notice, pageHeader } from "../components.js";
import { createLandmarker } from "../landmarker.js";
import { createCamera, cameraSupported, CAMERA_ERROR_TEXT } from "../camera.js";
import { drawOverlay } from "../overlay.js";
import { analysesInLast24h, endCapture, logAnalysis, state, type CaptureSession } from "../../app/state.js";
import { go } from "../../app/router.js";
import { loadImageFile, ImageInputError, wipeImage, type LoadedImage } from "../../image/input.js";
import { detect, loadDetector } from "../../analysis/detector.js";
import { analyzePhoto, buildSession, InvalidPointsError, type PhotoAnalysis } from "../../analysis/observations.js";
import type { CaptureContext } from "../../analysis/quality.js";
import type { PointSet, Point } from "../../analysis/points.js";

export const MAX_PHOTOS = 5;

type Phase =
  | { kind: "prepare"; error?: string }
  | { kind: "working"; message: string }
  | { kind: "landmark"; image: LoadedImage }
  | { kind: "camera" }
  | { kind: "review"; image: LoadedImage; analysis: PhotoAnalysis | null; mesh?: Point[]; error?: string };

let phase: Phase = { kind: "prepare" };
let draft: { distance: CaptureContext["distance"] | null; declared: NonNullable<CaptureContext["declared"]> } = {
  distance: null,
  declared: { facingCamera: true, mouthClosed: true, neutral: true, noGlasses: true },
};

const autoAvailable = () => state.detector?.available === true;

let stopCamera: (() => void) | null = null;

function releaseCamera(): void {
  stopCamera?.();
  stopCamera = null;
}

export function resetAnalyse(): void {
  releaseCamera();
  phase = { kind: "prepare" };
}

export function renderAnalyse(root: HTMLElement): void {
  clear(root);
  if (state.settings.adult !== true) {
    root.append(
      pageHeader("Analyse de photo"),
      card(null, h("p", null, "Les mesures du visage sont réservées aux 18 ans et plus. Vous pouvez suivre le programme d'habitudes et les conseils de prise de vue."), h("div", { class: "button-row" }, linkButton("Mon programme", "#programme"))),
    );
    return;
  }
  if (state.capture?.finished && phase.kind === "prepare") {
    endCapture();
    draft.distance = null;
  }
  switch (phase.kind) {
    case "prepare": return renderPrepare(root, phase.error);
    case "working": return renderWorking(root, phase.message);
    case "landmark": return renderLandmark(root, phase.image);
    case "review": return renderReview(root, phase);
    case "camera": return renderCamera(root);
  }
}

function rerenderHere(): void {
  const root = document.getElementById("view");
  if (root) renderAnalyse(root);
}

function setPhase(p: Phase): void {
  if (p.kind !== "camera") releaseCamera();
  phase = p;
  rerenderHere();
  // Chaque étape repart du haut de l'écran : sinon, sur mobile, on reste en bas
  // de la page précédente et l'on a l'impression que rien ne s'est passé.
  window.scrollTo({ top: 0 });
  document.getElementById("page-title")?.focus({ preventScroll: true });
}

function renderPrepare(root: HTMLElement, error?: string): void {
  const cap = state.capture;
  const adding = !!cap && cap.photos.length > 0;
  root.appendChild(pageHeader(adding ? `Photo ${cap!.photos.length + 1}` : "Analyse de photo", adding ? "Même lieu, même lumière, même distance que la précédente." : "Quelques réglages avant de commencer : ils décident de la fiabilité des mesures."));

  if (!adding && analysesInLast24h() >= 3) {
    root.appendChild(
      notice("info", h("p", null, "Vous avez déjà fait plusieurs analyses aujourd'hui. Vos traits ne changent pas d'un jour à l'autre : les différences viennent surtout de la lumière et de l'angle."), h("p", null, "Si vous pensez beaucoup à votre apparence en ce moment, ", h("a", { href: "#aide" }, "des ressources d'écoute existent"), ".")),
    );
  }
  if (error) root.appendChild(notice("block", h("p", null, error)));

  // Mode de repérage
  if (state.detector === null) {
    root.appendChild(notice("info", h("p", null, "Vérification du module de repérage automatique…")));
  } else if (!autoAvailable()) {
    root.appendChild(
      card(
        "Repérage manuel",
        h("p", null, "Le module de repérage automatique (MediaPipe) n'est pas installé dans cette version. Vous placerez vous-même 11 repères sur la photo, avec une loupe : comptez environ 2 minutes par photo."),
        h("p", { class: "muted small" }, "Reflet ne remplace jamais une détection absente par des résultats inventés. Pour activer le repérage automatique, l'hébergeur doit installer les fichiers du modèle (voir la documentation)."),
      ),
    );
  } else {
    root.appendChild(notice("info", h("p", null, "Repérage automatique disponible : le modèle fonctionne dans votre navigateur, hors ligne.")));
  }

  if (!adding) {
    root.appendChild(
      card(
        "Bien prendre la photo",
        h("p", null, h("strong", null, "L'essentiel : "), "retardateur à environ 1,5\u00a0m avec le zoom ×2, face à une fenêtre, tête droite, expression neutre, 3 photos."),
        details(
          "Pourquoi et comment",
          h(
            "ol",
            { class: "steps" },
            h("li", null, h("strong", null, "Distance : "), "posez le téléphone (ou demandez à quelqu'un) à environ 1,5\u00a0m, avec le zoom ×2 et le retardateur. À bout de bras, le nez paraît environ 30\u00a0% plus large."),
            h("li", null, h("strong", null, "Lumière : "), "face à une fenêtre, en lumière du jour indirecte, sans flash. Une lumière de côté crée de fausses asymétries."),
            h("li", null, h("strong", null, "Pose : "), "objectif à hauteur des yeux, tête droite, regard dans l'objectif."),
            h("li", null, h("strong", null, "Expression : "), "neutre, lèvres jointes sans serrer, cheveux dégagés du front et des oreilles, sans lunettes."),
            h("li", null, h("strong", null, "Plusieurs photos : "), "une mesure n'est jugée «\u00a0fiable\u00a0» que si 3 photos prises dans les mêmes conditions concordent."),
          ),
        ),
      ),
    );
    root.appendChild(
      card(
        "Conditions de prise de vue",
        choiceGroup(
          "distance",
          "Comment la photo a-t-elle été prise ?",
          [
            { value: "far", label: "À environ 1 m ou plus", hint: "Retardateur, appui, ou photo prise par quelqu'un." },
            { value: "near", label: "À bout de bras", hint: "Selfie classique." },
            { value: "unknown", label: "Je ne sais pas" },
          ],
          draft.distance,
          (v) => {
            draft.distance = v;
            rerenderHere();
          },
        ),
        h(
          "fieldset",
          { class: "choices" },
          h("legend", null, "Sur la photo :"),
          !autoAvailable() ? checkbox("Je regarde droit vers l'objectif", draft.declared.facingCamera, (v) => (draft.declared.facingCamera = v)) : null,
          !autoAvailable() ? checkbox("Ma bouche est fermée", draft.declared.mouthClosed, (v) => (draft.declared.mouthClosed = v)) : null,
          !autoAvailable() ? checkbox("Mon expression est neutre", draft.declared.neutral, (v) => (draft.declared.neutral = v)) : null,
          checkbox("Je ne porte pas de lunettes", draft.declared.noGlasses, (v) => (draft.declared.noGlasses = v)),
        ),
      ),
    );
  } else {
    root.appendChild(
      notice("info", h("p", null, `Conditions de cette séance : ${cap!.distance === "far" ? "à 1 m ou plus" : cap!.distance === "near" ? "à bout de bras" : "distance inconnue"}. Gardez-les identiques.`)),
    );
  }

  root.appendChild(
    card(
      adding ? "Ajouter une photo" : "Choisir la photo",
      photoPicker(),
      h("p", { class: "muted small" }, "JPEG, PNG, WebP ou HEIC, 15 Mo au maximum. La photo reste sur cet appareil et n'est pas enregistrée."),
      !adding && draft.distance === null
        ? h("p", { class: "muted small" }, "Distance non indiquée : elle sera considérée comme inconnue, et les rapports impliquant la largeur du nez seront masqués.")
        : null,
    ),
  );
  if (adding) {
    root.appendChild(h("div", { class: "button-row" }, button("Voir les résultats avec les photos actuelles", finish, { variant: "ghost", icon: "arrow" })));
  }
}

/**
 * Sélecteur de photo compatible avec un maximum de navigateurs et de visionneuses :
 *  - le champ fichier lui-même, transparent, recouvre tout le bouton : le doigt
 *    touche directement le champ (pas de transfert par <label>, pas de clic
 *    simulé, que certaines vues web intégrées ignorent) ;
 *  - accept="image/*" sans attribut capture : le téléphone propose lui-même
 *    l'appareil photo ou la galerie, et iOS convertit le HEIC en JPEG ;
 *  - si aucun sélecteur ne s'ouvre (la page ne perd pas le focus), une aide
 *    s'affiche avec deux solutions : ouvrir dans le navigateur, ou coller l'image ;
 *  - glisser-déposer et collage.
 */
function photoPicker(): HTMLElement {
  const input = h("input", { type: "file", accept: "image/*", class: "file-overlay", id: "photo-input", "aria-label": "Prendre ou choisir une photo", "data-testid": "file-gallery" });
  const help = h("div", { class: "picker-help", "aria-live": "polite" });
  let pending: number | undefined;
  let left = false;
  const markLeft = () => (left = true);
  input.addEventListener("click", () => {
    left = false;
    window.addEventListener("blur", markLeft, { once: true });
    document.addEventListener("visibilitychange", markLeft, { once: true });
    window.clearTimeout(pending);
    pending = window.setTimeout(() => {
      if (!left && !input.files?.length) showPickerHelp(help);
    }, 1800);
  });
  input.addEventListener("change", () => {
    window.clearTimeout(pending);
    help.replaceChildren();
    const f = input.files?.[0];
    if (f) void handleFile(f);
    input.value = "";
  });

  const pickBtn = h("div", { class: `btn ${cameraSupported() ? "btn-ghost" : "btn-primary"} btn-wide picker-button` }, icon("image", 18), h("span", null, "Choisir une photo"), input);
  const camBtn = cameraSupported()
    ? h("button", { type: "button", class: "btn btn-primary btn-wide", "data-testid": "open-camera", onclick: (() => setPhase({ kind: "camera" })) as EventListener }, icon("camera", 18), h("span", null, "Ouvrir la caméra"))
    : null;

  const paste = h("div", {
    class: "paste-zone", contenteditable: "true", role: "textbox", "aria-label": "Zone de collage d'image", "data-testid": "paste-zone",
    "aria-multiline": "false", inputmode: "none",
  });
  paste.addEventListener("paste", (e) => {
    const item = [...(e.clipboardData?.items ?? [])].find((i) => i.kind === "file" && i.type.startsWith("image/"));
    const f = item?.getAsFile();
    e.preventDefault();
    if (f) void handleFile(f);
    else help.replaceChildren(notice("warn", h("p", null, "Le presse-papiers ne contient pas d'image. Dans la galerie, ouvrez la photo, puis « Copier », et recommencez.")));
  });
  // Rien d'autre qu'une image ne peut entrer dans la zone : ni texte, ni HTML collé ou déposé.
  paste.addEventListener("beforeinput", (e) => e.preventDefault());
  paste.addEventListener("drop", (e) => e.preventDefault());
  paste.addEventListener("input", () => (paste.textContent = ""));

  const zone = h(
    "div",
    { class: "drop-zone" },
    h("div", { class: "picker-buttons" }, camBtn, pickBtn),
    help,
    h("p", { class: "muted small drop-hint" }, "Sur ordinateur : glissez une image ici ou collez-la (Ctrl/⌘ + V)."),
    details(
      "Autre méthode : coller une photo",
      h("p", { class: "small" }, "Dans votre galerie, ouvrez la photo et choisissez « Copier ». Revenez ici, appuyez longuement dans le cadre ci-dessous, puis « Coller »."),
      paste,
    ),
  );
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("dragging");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragging"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dragging");
    const f = e.dataTransfer?.files?.[0];
    if (f) void handleFile(f);
  });
  return zone;
}

function showPickerHelp(help: HTMLElement): void {
  help.replaceChildren(
    notice(
      "warn",
      h("p", null, h("strong", null, "La galerie ne s'est pas ouverte ? "), "L'application qui affiche Reflet bloque peut-être l'accès aux fichiers."),
      h("p", null, cameraSupported() ? "Utilisez « Ouvrir la caméra », ou « Autre méthode : coller une photo » ci-dessous." : "Utilisez « Autre méthode : coller une photo » ci-dessous."),
    ),
  );
}

function renderCamera(root: HTMLElement): void {
  releaseCamera();
  const err = h("div");
  const cam = createCamera({
    onCapture: (file) => {
      stopCamera = null;
      void handleFile(file);
    },
    onCancel: () => {
      stopCamera = null;
      setPhase({ kind: "prepare" });
    },
    onError: (e) => {
      stopCamera = null;
      setPhase({ kind: "prepare", error: CAMERA_ERROR_TEXT[e] });
    },
  });
  stopCamera = cam.stop;
  root.append(pageHeader("Caméra", "Visage dans l'ovale, regard dans l'objectif, expression neutre."), err, cam.element);
}

/** Collage d'une image depuis le presse-papiers, actif seulement sur l'écran de préparation. */
document.addEventListener("paste", (e) => {
  if (phase.kind !== "prepare" || location.hash !== "#analyse") return;
  const item = [...(e.clipboardData?.items ?? [])].find((i) => i.kind === "file" && i.type.startsWith("image/"));
  const f = item?.getAsFile();
  if (f) {
    e.preventDefault();
    void handleFile(f);
  }
});

function ensureCapture(): CaptureSession {
  if (!state.capture) {
    state.capture = { distance: draft.distance ?? "unknown", declared: { ...draft.declared }, photos: [], images: [], fingerprints: new Set(), finished: false };
  }
  return state.capture;
}

async function handleFile(file: File): Promise<void> {
  try {
    await processFile(file);
  } catch (e) {
    console.error(e);
    setPhase({ kind: "prepare", error: `La photo n'a pas pu être traitée (${e instanceof Error ? e.message : "erreur inconnue"}). Réessayez avec une autre photo.` });
  }
}

async function processFile(file: File): Promise<void> {
  setPhase({ kind: "working", message: "Lecture de la photo…" });
  let img: LoadedImage;
  try {
    img = await loadImageFile(file);
  } catch (e) {
    setPhase({ kind: "prepare", error: e instanceof ImageInputError ? e.message : "Impossible de lire cette photo." });
    return;
  }
  const cap = ensureCapture();
  if (cap.fingerprints.has(img.fingerprint)) {
    wipeImage(img);
    setPhase({ kind: "prepare", error: "Cette photo a déjà été ajoutée à la séance. Plusieurs photos différentes sont nécessaires pour vérifier la répétabilité." });
    return;
  }
  if (autoAvailable()) {
    setPhase({ kind: "working", message: "Chargement du modèle local…" });
    try {
      await loadDetector();
      setPhase({ kind: "working", message: "Repérage du visage…" });
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const det = await detect(img.canvas);
      if (det.faceCount === 0 || !det.points) {
        wipeImage(img);
        setPhase({ kind: "prepare", error: "Aucun visage n'a été détecté. Essayez une photo de face, bien éclairée, où le visage occupe une bonne partie du cadre." });
        return;
      }
      const ctx: CaptureContext = {
        mode: "auto", distance: cap.distance, imageShortSide: img.shortSideOriginal,
        pose: det.pose, expression: det.expression, faceCount: det.faceCount, declared: cap.declared,
      };
      runAnalysis(img, det.points, ctx, det.landmarksPx);
    } catch (e) {
      console.error(e);
      state.detector = { available: false, reason: "Le module automatique n'a pas pu démarrer sur cet appareil." };
      setPhase({ kind: "landmark", image: img });
      announce("Le repérage automatique a échoué ; passage au repérage manuel.");
    }
  } else {
    setPhase({ kind: "landmark", image: img });
  }
}

function runAnalysis(img: LoadedImage, points: PointSet, ctx: CaptureContext, mesh?: Point[]): void {
  const cap = ensureCapture();
  try {
    const a = analyzePhoto(`photo-${cap.photos.length + 1}`, points, img.pixels, ctx);
    if (!a.blocked) {
      cap.photos.push(a);
      cap.images.push(img);
      cap.fingerprints.add(img.fingerprint);
    }
    setPhase({ kind: "review", image: img, analysis: a, mesh });
  } catch (e) {
    const msg = e instanceof InvalidPointsError ? `Repères incohérents : ${e.problems.join(" ")}` : "L'analyse de cette photo a échoué.";
    setPhase({ kind: "review", image: img, analysis: null, error: msg });
  }
}

function renderWorking(root: HTMLElement, message: string): void {
  root.append(pageHeader("Analyse en cours"), h("div", { class: "working", role: "status" }, h("span", { class: "spinner", "aria-hidden": "true" }), h("p", null, message)));
}

function renderLandmark(root: HTMLElement, image: LoadedImage): void {
  const cap = ensureCapture();
  root.append(
    pageHeader("Placez les repères", "Touchez la photo à l'endroit demandé. Glissez pour ajuster : une loupe apparaît au-dessus du doigt."),
    createLandmarker({
      image: image.canvas,
      onDone: (points) => {
        const ctx: CaptureContext = { mode: "manual", distance: cap.distance, imageShortSide: image.shortSideOriginal, declared: cap.declared };
        runAnalysis(image, points, ctx);
      },
      onCancel: () => {
        wipeImage(image);
        setPhase({ kind: "prepare" });
      },
    }),
  );
}

function renderReview(root: HTMLElement, p: Extract<Phase, { kind: "review" }>): void {
  const cap = ensureCapture();
  const a = p.analysis;
  root.appendChild(pageHeader(a?.blocked ? "Photo non exploitable" : "Contrôle de la photo", a && !a.blocked ? `${cap.photos.length} photo${cap.photos.length > 1 ? "s" : ""} retenue${cap.photos.length > 1 ? "s" : ""} dans cette séance.` : undefined));

  const canvas = h("canvas", { class: "review-canvas", role: "img", "aria-label": "Photo avec les repères placés, la ligne des yeux et l'axe du visage" });
  if (a) drawOverlay(canvas, p.image.canvas, a.points, { axes: true, mesh: p.mesh, crop: true });
  root.appendChild(card(null, canvas, h("p", { class: "muted small" }, "Pointillés : ligne des yeux et axe de référence. L'inclinaison de la tête est corrigée par calcul.")));

  if (p.error) root.appendChild(notice("block", h("p", null, p.error)));
  if (a) {
    const blocks = a.issues.filter((i) => i.severity === "block");
    const warns = a.issues.filter((i) => i.severity === "warn");
    if (blocks.length) {
      root.appendChild(card("Pourquoi cette photo est refusée", h("ul", { class: "issue-list" }, blocks.map((i) => h("li", null, h("strong", null, i.message), " ", i.advice)))));
      wipeImage(p.image);
    }
    if (warns.length) {
      root.appendChild(card("Points d'attention", h("ul", { class: "issue-list" }, warns.map((i) => h("li", null, h("strong", null, i.message), " ", i.advice)))));
    }
    if (!blocks.length && !warns.length) {
      root.appendChild(notice("info", h("p", null, "Aucun problème de qualité détecté sur cette photo.")));
    }
  }

  const canAdd = cap.photos.length < MAX_PHOTOS;
  root.appendChild(
    h(
      "div",
      { class: "button-row" },
      canAdd ? button(cap.photos.length ? "Ajouter une autre photo" : "Essayer une autre photo", () => setPhase({ kind: "prepare" }), { variant: cap.photos.length >= 3 ? "ghost" : "primary", icon: "plus" }) : null,
      cap.photos.length ? button("Voir les résultats", finish, { variant: cap.photos.length >= 3 || !canAdd ? "primary" : "ghost", icon: "arrow" }) : null,
    ),
  );
  if (cap.photos.length > 0 && cap.photos.length < 3) {
    root.appendChild(h("p", { class: "muted small" }, `Encore ${3 - cap.photos.length} photo${3 - cap.photos.length > 1 ? "s" : ""} pour pouvoir confirmer une mesure.`));
  }
}

function finish(): void {
  const cap = state.capture;
  if (!cap || cap.photos.length === 0) return;
  state.result = buildSession(cap.photos, cap.distance);
  cap.finished = true;
  logAnalysis();
  phase = { kind: "prepare" };
  go("resultats");
}

export function abandonCapture(): void {
  endCapture();
  phase = { kind: "prepare" };
}
